#!/usr/bin/env node
/**
 * Attendance rules test (HTTP API, same flow as the employee check-in screen).
 *
 * Creates throw-away companies ("ZZATT ..."), one employee account per scenario, and work schedules
 * placed relative to the current time in the company timezone, then checks in through
 * POST /api/attendance/me and verifies the response, the database row and GET /api/attendance/me.
 *
 * Covers: late / on time / within grace, day off (disabled weekday), weekday override of the base
 * time, inactive division schedule -> company schedule, no division -> company schedule, no
 * schedule at all (not judged), check-out before check-in, double check-in/out, concurrent
 * check-ins, and the geofence (no location, outside, inside, accuracy allowance and its cap).
 *
 *   npm run test:attendance
 *   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/test-attendance.mjs
 *
 * Exit code 1 when any check fails. All ZZATT data is removed at start and in `finally`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DATABASE_URL = process.env.DATABASE_URL || readEnv("DATABASE_URL");
if (!DATABASE_URL) { console.error("DATABASE_URL is not set and was not found in .env / .env.local"); process.exit(2); }

const PASSWORD = "ZzAtt-Test-Password-2026!";
const EMAIL_PREFIX = "zzatt-";
const COMPANY_PREFIX = "ZZATT ";
const TZ = "Asia/Jakarta";
const OFFICE = { lat: -6.2, lng: 106.816666 };

const db = new pg.Client({ connectionString: DATABASE_URL });
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv(key) {
  for (const file of [".env", ".env.local"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, "utf8").split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function record(pass, name, detail = "") {
  results.push({ pass, name });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

/** Current date, weekday (1 = Monday) and minute of the day in the company timezone. */
function nowInZone() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
const clock = (minute) => { const m = Math.min(Math.max(minute, 0), 23 * 60 + 59); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`; };
/** Point `meters` north of the office. */
const north = (meters) => ({ lat: OFFICE.lat + meters / 111_320, lng: OFFICE.lng });

async function login(email) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: BASE_URL }, body: JSON.stringify({ email, password: PASSWORD }) });
    if (res.status === 429) { await sleep(Math.max(Number(res.headers.get("x-retry-after") || res.headers.get("retry-after") || 0) * 1000, 3000) + 500); continue; }
    if (res.status !== 200) throw new Error(`Login ${email}: HTTP ${res.status} ${await res.text()}`);
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
    if (!cookie.includes("session_token")) throw new Error(`Login ${email}: no session cookie`);
    return cookie;
  }
  throw new Error(`Login ${email}: rate limited`);
}

let photo;
async function attend(cookie, action, location, { withPhoto = true } = {}) {
  const form = new FormData();
  form.set("action", action);
  form.set("clientCapturedAt", new Date().toISOString());
  if (location) { form.set("latitude", String(location.lat)); form.set("longitude", String(location.lng)); form.set("accuracyMeters", String(location.accuracy ?? 5)); }
  if (withPhoto) form.set("photo", new Blob([photo], { type: "image/jpeg" }), "kamera.jpg");
  const res = await fetch(`${BASE_URL}/api/attendance/me`, { method: "POST", headers: { origin: BASE_URL, cookie }, body: form });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function status(cookie) {
  const res = await fetch(`${BASE_URL}/api/attendance/me`, { headers: { origin: BASE_URL, cookie } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function cleanup() {
  const companies = (await db.query(`select id from companies where name like $1`, [`${COMPANY_PREFIX}%`])).rows.map((r) => r.id);
  if (companies.length) {
    // Attendance photos reference file_assets; remove dependent rows before the companies cascade.
    await db.query(`delete from attendance_events where company_id = any($1)`, [companies]);
    await db.query(`delete from attendances where company_id = any($1)`, [companies]);
    await db.query(`delete from file_assets where company_id = any($1)`, [companies]);
    await db.query(`delete from companies where id = any($1)`, [companies]);
  }
  await db.query(`delete from "user" where email like $1`, [`${EMAIL_PREFIX}%`]);
}

const hash = await hashPassword(PASSWORD);
async function createCompany(label) {
  const { rows: [company] } = await db.query(`insert into companies (name, industry, timezone) values ($1, 'Testing', $2) returning id`, [`${COMPANY_PREFIX}${label}`, TZ]);
  return company.id;
}
/** Employee account (role employee) linked to an employee record in `department`. */
async function createEmployee(companyId, key, department) {
  const userId = randomUUID();
  const email = `${EMAIL_PREFIX}${key}-${randomBytes(3).toString("hex")}@example.com`;
  await db.query(`insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`, [userId, `ZZ ${key}`, email]);
  await db.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [randomUUID(), userId, hash]);
  await db.query(`insert into company_members (company_id, user_id, role) values ($1, $2, 'employee')`, [companyId, userId]);
  const { rows: [employee] } = await db.query(
    `insert into employees (company_id, employee_code, name, email, department, position, joined_at, user_id) values ($1, $2, $3, $4, $5, 'Staf', current_date, $6) returning id`,
    [companyId, `ZZ-${key}`, `ZZ ${key}`, email, department ?? "Tanpa Divisi", userId]);
  return { employeeId: employee.id, cookie: await login(email) };
}
/** Schedule with base times; `today` overrides today's weekday row ({ start, enabled }). */
async function createSchedule(companyId, name, { start, grace = 15, active = true, today }, weekday) {
  const { rows: [schedule] } = await db.query(
    `insert into work_schedules (company_id, name, start_time, end_time, grace_minutes, active, work_days) values ($1, $2, $3, '23:59:00', $4, $5, 'Senin–Minggu') returning id`,
    [companyId, `${COMPANY_PREFIX}${name}`, start, grace, active]);
  if (today) await db.query(`insert into work_schedule_days (schedule_id, day_of_week, enabled, start_time, end_time) values ($1, $2, $3, $4, '23:59:00')`, [schedule.id, weekday, today.enabled ?? true, today.start ?? start]);
  return schedule.id;
}
async function createDivision(companyId, name, scheduleId) {
  await db.query(`insert into divisions (company_id, name, schedule_id, active) values ($1, $2, $3, true)`, [companyId, name, scheduleId]);
}
/** Company admin account (for the admin attendance API). Returns the session cookie. */
async function createAdmin(companyId, key) {
  const userId = randomUUID();
  const email = `${EMAIL_PREFIX}${key}-${randomBytes(3).toString("hex")}@example.com`;
  await db.query(`insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`, [userId, `ZZ ${key}`, email]);
  await db.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [randomUUID(), userId, hash]);
  await db.query(`insert into company_members (company_id, user_id, role) values ($1, $2, 'admin')`, [companyId, userId]);
  return login(email);
}
/** Object storage of the local Docker stack (docker-compose.yml defaults); null when unreachable. */
async function storageClient() {
  const client = new S3Client({
    endpoint: process.env.TEST_S3_ENDPOINT || `http://127.0.0.1:${readEnv("OBJECT_STORAGE_PORT") || 9000}`, region: "us-east-1", forcePathStyle: true,
    credentials: { accessKeyId: process.env.TEST_S3_ACCESS_KEY || "tepatwaktu-local", secretAccessKey: process.env.TEST_S3_SECRET_KEY || "tepatwaktu-local-storage-secret" },
  });
  try { await client.send(new HeadObjectCommand({ Bucket: "tepatwaktu-private", Key: "__probe__" })); } catch (error) { if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound") return null; }
  return client;
}
async function objectExists(client, bucket, key) {
  try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; } catch (error) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return false; throw error; }
}
const dbStatus = async (employeeId, date) => (await db.query(`select status, check_in, check_out from attendances where employee_id = $1 and attendance_date = $2`, [employeeId, date])).rows[0];

try {
  await db.connect();
  await cleanup();
  photo = await sharp(randomBytes(64 * 64 * 3), { raw: { width: 64, height: 64, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();

  const now = nowInZone();
  const early = now.minute >= 150 && now.minute <= 22 * 60; // room for "2 hours ago" and "1 hour from now"
  if (!early) console.log(`NOTE  ${clock(now.minute)} ${TZ}: too close to midnight for the timing scenarios; only rule checks that do not depend on the clock run.`);
  const past = clock(now.minute - 120), future = clock(now.minute + 60), withinGrace = clock(now.minute - 5);

  // ---- Company A: schedules ------------------------------------------------------------------
  const companyA = await createCompany("Jadwal");
  // Oldest active schedule = the company schedule used without (a usable) division.
  await createSchedule(companyA, "Perusahaan", { start: past });
  await sleep(20); // created_at ordering
  const scenarios = [
    { key: "late", label: "lewat jam masuk + toleransi -> terlambat", schedule: { start: past }, expect: "late", timing: true },
    { key: "ontime", label: "sebelum jam masuk -> hadir", schedule: { start: future }, expect: "present", timing: true },
    { key: "grace", label: "dalam toleransi 15 menit -> hadir", schedule: { start: withinGrace }, expect: "present", timing: true },
    { key: "dayoff", label: "hari libur (hari ini dinonaktifkan) -> hadir, bukan terlambat", schedule: { start: past, today: { enabled: false } }, expect: "present", workday: false, timing: true },
    { key: "override", label: "jam khusus hari ini menimpa jam dasar -> terlambat", schedule: { start: future, today: { start: past } }, expect: "late", timing: true },
    { key: "override-early", label: "jam khusus hari ini lebih siang dari jam dasar -> hadir", schedule: { start: past, today: { start: future } }, expect: "present", timing: true },
    { key: "inactive", label: "jadwal divisi nonaktif -> pakai jadwal perusahaan (terlambat)", schedule: { start: future, active: false }, expect: "late", source: "company", timing: true },
  ];
  for (const s of scenarios) {
    if (s.timing && !early) continue;
    const scheduleId = await createSchedule(companyA, s.key, s.schedule, now.weekday);
    await createDivision(companyA, `Divisi ${s.key}`, scheduleId);
    const { employeeId, cookie } = await createEmployee(companyA, s.key, `Divisi ${s.key}`);
    const before = await status(cookie);
    const res = await attend(cookie, "check_in");
    const row = await dbStatus(employeeId, now.date);
    record(res.status === 201 && res.body.status === s.expect && row?.status === s.expect, `Jadwal: ${s.label}`, `HTTP ${res.status}, status ${res.body.status ?? res.body.message}, db ${row?.status}`);
    if (s.workday === false) record(before.body.schedule?.isWorkday === false, "Jadwal: layar check-in menampilkan hari libur", JSON.stringify(before.body.schedule));
    if (s.source) record(before.body.schedule?.source === s.source, `Jadwal: layar check-in memakai sumber "${s.source}"`, JSON.stringify(before.body.schedule));
    if (s.key === "override") record(before.body.schedule?.startTime === past, "Jadwal: layar check-in menampilkan jam khusus hari ini", `${before.body.schedule?.startTime} vs ${past}`);
  }
  if (early) {
    const { employeeId, cookie } = await createEmployee(companyA, "nodiv", "Divisi Tidak Ada");
    const before = await status(cookie);
    const res = await attend(cookie, "check_in");
    record(res.status === 201 && res.body.status === "late" && (await dbStatus(employeeId, now.date))?.status === "late" && before.body.schedule?.source === "company",
      "Jadwal: tanpa divisi -> jadwal perusahaan tertua (terlambat)", `HTTP ${res.status}, ${res.body.status ?? res.body.message}, source ${before.body.schedule?.source}`);
  }

  // ---- Check-in / check-out sequence and concurrency -----------------------------------------
  {
    const { employeeId, cookie } = await createEmployee(companyA, "flow", "Divisi Tidak Ada");
    const out1 = await attend(cookie, "check_out");
    record(out1.status === 409 && !(await dbStatus(employeeId, now.date)), "Alur: check-out sebelum check-in ditolak (409) tanpa membuat data", `HTTP ${out1.status} ${out1.body.message ?? ""}`);
    const in1 = await attend(cookie, "check_in");
    const in2 = await attend(cookie, "check_in");
    record(in1.status === 201 && in2.status === 409, "Alur: check-in kedua di hari yang sama ditolak (409)", `HTTP ${in1.status} lalu ${in2.status}`);
    const out2 = await attend(cookie, "check_out");
    const out3 = await attend(cookie, "check_out");
    const row = await dbStatus(employeeId, now.date);
    record(out2.status === 201 && out3.status === 409 && row?.check_in && row?.check_out, "Alur: check-out tercatat sekali, yang kedua ditolak (409)", `HTTP ${out2.status} lalu ${out3.status}`);
    const after = await status(cookie);
    record(after.body.nextAction === null, "Alur: setelah check-in dan check-out tidak ada aksi berikutnya", String(after.body.nextAction));
  }
  {
    const { employeeId, cookie } = await createEmployee(companyA, "race", "Divisi Tidak Ada");
    const responses = await Promise.all(Array.from({ length: 6 }, () => attend(cookie, "check_in")));
    const created = responses.filter((r) => r.status === 201).length;
    const events = (await db.query(`select count(*)::int as n from attendance_events where employee_id = $1 and type = 'check_in'`, [employeeId])).rows[0].n;
    record(created === 1 && events === 1 && responses.every((r) => r.status === 201 || r.status === 409),
      "Alur: 6 check-in bersamaan -> tepat 1 tercatat, sisanya 409", responses.map((r) => r.status).join(","));
  }

  // ---- Company B: no schedule, then geofence -------------------------------------------------
  const companyB = await createCompany("Tanpa Jadwal");
  {
    const { employeeId, cookie } = await createEmployee(companyB, "default", null);
    const before = await status(cookie);
    const res = await attend(cookie, "check_in");
    record(res.status === 201 && res.body.status === "present" && (await dbStatus(employeeId, now.date))?.status === "present" && before.body.schedule?.source === "default",
      "Jadwal: perusahaan tanpa jadwal -> tidak dinilai terlambat, layar memakai sumber default", `HTTP ${res.status}, ${res.body.status ?? res.body.message}, source ${before.body.schedule?.source}`);
  }
  await db.query(`insert into attendance_locations (company_id, name, address, latitude, longitude, radius_meters, active) values ($1, 'ZZ Kantor', 'Jl. Uji Coba', $2, $3, 100, true)`, [companyB, OFFICE.lat, OFFICE.lng]);
  {
    const { employeeId, cookie } = await createEmployee(companyB, "geo", null);
    const none = await attend(cookie, "check_in");
    record(none.status === 422, "Geofence: tanpa koordinat ditolak (422)", `HTTP ${none.status} ${none.body.message ?? ""}`);
    const far = await attend(cookie, "check_in", north(1000));
    record(far.status === 422, "Geofence: 1 km dari kantor ditolak (422)", `HTTP ${far.status} ${far.body.message ?? ""}`);
    record(!(await dbStatus(employeeId, now.date)), "Geofence: percobaan yang ditolak tidak meninggalkan data presensi");
    const inside = await attend(cookie, "check_in", north(30));
    record(inside.status === 201, "Geofence: 30 m dari kantor diterima", `HTTP ${inside.status} ${inside.body.message ?? ""}`);
  }
  {
    const { cookie } = await createEmployee(companyB, "geo-acc", null);
    const res = await attend(cookie, "check_in", { ...north(120), accuracy: 30 });
    record(res.status === 201, "Geofence: 120 m dengan akurasi GPS 30 m diterima (radius 100 + 30)", `HTTP ${res.status} ${res.body.message ?? ""}`);
  }
  {
    const { cookie } = await createEmployee(companyB, "geo-cap", null);
    const res = await attend(cookie, "check_in", { ...north(200), accuracy: 5000 });
    record(res.status === 422, "Geofence: akurasi buruk tidak memperluas radius lebih dari 50 m (200 m ditolak)", `HTTP ${res.status} ${res.body.message ?? ""}`);
  }

  // ---- Kunci Lokasi / Kunci Foto (employee list switches) ----------------------------------
  const setLocks = (employeeId, { location, photo: lockPhoto }) => db.query(`update employees set lock_location = $2, lock_photo = $3 where id = $1`, [employeeId, location, lockPhoto]);
  {
    const { employeeId, cookie } = await createEmployee(companyB, "lock-on", null);
    const st = await status(cookie);
    record(st.body.rules?.requireLocation === true && st.body.rules?.requirePhoto === true, "Kunci: default lokasi & foto wajib (layar check-in menerima aturannya)", JSON.stringify(st.body.rules));
    void employeeId;
  }
  {
    const { employeeId, cookie } = await createEmployee(companyB, "loc-off", null);
    await setLocks(employeeId, { location: false, photo: true });
    const st = await status(cookie);
    record(st.body.rules?.requireLocation === false, "Kunci Lokasi mati: layar check-in tahu lokasi tidak wajib", JSON.stringify(st.body.rules));
    const far = await attend(cookie, "check_in", north(1000));
    const event = (await db.query(`select latitude from attendance_events where employee_id = $1`, [employeeId])).rows[0];
    record(far.status === 201 && event?.latitude != null, "Kunci Lokasi mati: 1 km dari kantor diterima, koordinat tetap dicatat", `HTTP ${far.status} ${far.body.message ?? ""}`);
  }
  {
    const { employeeId, cookie } = await createEmployee(companyB, "loc-off-nogps", null);
    await setLocks(employeeId, { location: false, photo: true });
    const res = await attend(cookie, "check_in");
    record(res.status === 201, "Kunci Lokasi mati: tanpa koordinat GPS diterima", `HTTP ${res.status} ${res.body.message ?? ""}`);
  }
  {
    const { employeeId, cookie } = await createEmployee(companyB, "photo-off", null);
    await setLocks(employeeId, { location: false, photo: false });
    const st = await status(cookie);
    const res = await attend(cookie, "check_in", undefined, { withPhoto: false });
    const event = (await db.query(`select photo_asset_id from attendance_events where employee_id = $1`, [employeeId])).rows[0];
    record(st.body.rules?.requirePhoto === false && res.status === 201 && event && event.photo_asset_id === null, "Kunci Foto mati: presensi tanpa foto diterima", `HTTP ${res.status} ${res.body.message ?? ""}`);
  }
  {
    const { employeeId, cookie } = await createEmployee(companyB, "photo-on", null);
    await setLocks(employeeId, { location: false, photo: true });
    const res = await attend(cookie, "check_in", undefined, { withPhoto: false });
    record(res.status === 400 && /Foto/.test(res.body.message ?? "") && !(await dbStatus(employeeId, now.date)), "Kunci Foto aktif: tanpa foto ditolak tanpa membuat data", `HTTP ${res.status} ${res.body.message ?? ""}`);
  }

  // ---- Deleting an attendance removes its photos (database + object storage) ------------------
  {
    const { employeeId, cookie } = await createEmployee(companyB, "hapus", null);
    await setLocks(employeeId, { location: false, photo: true });
    const inRes = await attend(cookie, "check_in");
    const outRes = await attend(cookie, "check_out");
    const assets = (await db.query(`select f.id, f.bucket, f.object_key from attendance_events e join file_assets f on f.id = e.photo_asset_id where e.employee_id = $1`, [employeeId])).rows;
    const storage = await storageClient();
    const existsBefore = storage ? (await Promise.all(assets.map((a) => objectExists(storage, a.bucket, a.object_key)))).every(Boolean) : null;
    const adminCookie = await createAdmin(companyB, "hapus-admin");
    const del = await fetch(`${BASE_URL}/api/attendance/admin?id=${inRes.body.attendanceId}`, { method: "DELETE", headers: { origin: BASE_URL, cookie: adminCookie } });
    const assetsAfter = (await db.query(`select count(*)::int as n from file_assets where id = any($1)`, [assets.map((a) => a.id)])).rows[0].n;
    const existsAfter = storage ? (await Promise.all(assets.map((a) => objectExists(storage, a.bucket, a.object_key)))).some(Boolean) : null;
    record(inRes.status === 201 && outRes.status === 201 && assets.length === 2 && del.status === 200 && assetsAfter === 0 && !(await dbStatus(employeeId, now.date)),
      "Hapus presensi: presensi dan data foto check-in/out ikut terhapus", `HTTP ${del.status}, foto ${assets.length} -> sisa ${assetsAfter}`);
    if (storage) record(existsBefore === true && existsAfter === false, "Hapus presensi: file foto di object storage ikut terhapus", `sebelum ${existsBefore}, sesudah ${existsAfter}`);
    else console.log("NOTE  object storage tidak bisa dijangkau dari tes (atur TEST_S3_ENDPOINT); pemeriksaan file dilewati.");
  }
} catch (error) {
  record(false, "Unexpected error", error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await cleanup().catch((error) => console.error("Cleanup failed:", error));
  await db.end().catch(() => undefined);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nSummary: ${results.length - failed} passed, ${failed} failed, ${results.length} total`);
  process.exitCode = failed ? 1 : 0;
}
