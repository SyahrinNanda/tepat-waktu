#!/usr/bin/env node
/**
 * Tenant-isolation test (HTTP API).
 *
 * Creates two throw-away companies ("ZZISO A" / "ZZISO B"), each with an admin and an employee,
 * fills B with data through B's own API calls, then tries to read / modify / delete B's data as
 * A's admin and A's employee. Every check also verifies B's row in the database afterwards.
 * Positive controls prove that the same payloads work on A's own records.
 *
 *   node scripts/test-tenant-isolation.mjs
 *   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/test-tenant-isolation.mjs
 *
 * Exit code 1 when any check fails. All ZZISO data is removed at start and in `finally`.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DATABASE_URL = process.env.DATABASE_URL || readEnv("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set and was not found in .env / .env.local");
  process.exit(2);
}

const PASSWORD = "ZzIso-Test-Password-2026!";
const EMAIL_PREFIX = "zziso-";
const COMPANY_PREFIX = "ZZISO ";
const today = new Date().toISOString().slice(0, 10);
const [YEAR, MONTH] = today.split("-").map(Number);
const BUG_DATE = shiftDate(today, -1); // date used for the cross-tenant reference probe
// 1x1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const db = new pg.Client({ connectionString: DATABASE_URL });
const results = [];

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------
function readEnv(key) {
  for (const file of [".env", ".env.local"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, "utf8").split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (status) => status >= 200 && status < 300;

function record(pass, name, detail = "") {
  results.push({ pass, name });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

async function login(email) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get("x-retry-after") || res.headers.get("retry-after") || 0);
      await sleep(Math.max(retry * 1000, 3000) + 500);
      continue;
    }
    const text = await res.text();
    if (!ok(res.status)) throw new Error(`Login ${email} failed: ${res.status} ${text.slice(0, 200)}`);
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
    if (!cookie.includes("session_token")) throw new Error(`Login ${email}: no session cookie returned`);
    return cookie;
  }
  throw new Error(`Login ${email}: still rate-limited after retries`);
}

/** HTTP call as a user. opts: { json, form, cookie (extra cookie) } */
async function api(session, method, path, opts = {}) {
  const headers = { origin: BASE_URL, cookie: [session.cookie, opts.cookie].filter(Boolean).join("; ") };
  let body;
  if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.form) {
    body = new FormData();
    for (const [k, v] of Object.entries(opts.form)) {
      if (v === undefined || v === null) continue;
      if (v instanceof Blob) body.append(k, v, k === "file" ? "data.xlsx" : "image.png");
      else body.append(k, String(v));
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  let text = buf.toString("utf8");
  if (contentType.includes("spreadsheetml") || contentType.includes("zip")) text = unzipText(buf);
  let json = null;
  if (contentType.includes("json")) { try { json = JSON.parse(text); } catch { /* ignore */ } }
  return { status: res.status, text, json, contentType };
}

/** Minimal ZIP reader: returns entry names + inflated contents concatenated (for xlsx / zip). */
function unzipText(buf) {
  try {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return buf.toString("latin1");
    const entries = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = [];
    for (let n = 0; n < entries; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const csize = buf.readUInt32LE(p + 20);
      const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
      const local = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      let content = "";
      try { content = (method === 8 ? inflateRawSync(data) : data).toString("utf8"); } catch { content = ""; }
      out.push(`#ENTRY ${name}\n${content}`);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out.join("\n");
  } catch {
    return buf.toString("latin1");
  }
}

async function snapshot(table, id) {
  const { rows } = await db.query(`select row_to_json(t)::text as j from ${table} t where id = $1`, [id]);
  return rows[0]?.j ?? null;
}

async function snapshotQuery(sql, params) {
  const { rows } = await db.query(sql, params);
  return JSON.stringify(rows);
}

/**
 * Cross-tenant write/read attempt on one of B's rows. Passes only when the response is not 2xx
 * AND B's row is byte-for-byte unchanged (and still present).
 */
async function denied(name, request, snap) {
  try {
    const before = await snap();
    const res = await request();
    const after = await snap();
    const problems = [];
    if (ok(res.status)) problems.push(`got ${res.status}: ${res.text.slice(0, 160)}`);
    if (before === null || before === "[]") problems.push("B row missing before the attempt (test setup issue)");
    if (after !== before) problems.push(after === null || after === "[]" ? "B row was DELETED" : "B row was MODIFIED");
    if (!problems.length && containsB(res.text)) problems.push(`error body leaks B data: ${res.text.slice(0, 160)}`);
    record(!problems.length, name, problems.length ? problems.join("; ") : `status ${res.status}`);
  } catch (error) {
    record(false, name, `error: ${error.message}`);
  }
}

/** List / export endpoint: B markers must not appear in the response. */
async function noLeak(name, request, { requireOk = true } = {}) {
  try {
    const res = await request();
    const leaks = leakedMarkers(res.text);
    const problems = [];
    if (requireOk && !ok(res.status)) problems.push(`expected 2xx for own-company list, got ${res.status}: ${res.text.slice(0, 160)}`);
    if (leaks.length) problems.push(`LEAK of B data: ${leaks.slice(0, 5).join(", ")}`);
    record(!problems.length, name, problems.length ? problems.join("; ") : `status ${res.status}, no B data`);
  } catch (error) {
    record(false, name, `error: ${error.message}`);
  }
}

/** Positive control: A acting on A's own data must succeed. */
async function allowed(name, request, verify) {
  try {
    const res = await request();
    const problems = [];
    if (!ok(res.status)) problems.push(`expected 2xx, got ${res.status}: ${res.text.slice(0, 200)}`);
    if (!problems.length && verify) {
      const msg = await verify(res);
      if (msg) problems.push(msg);
    }
    record(!problems.length, `[control] ${name}`, problems.length ? problems.join("; ") : `status ${res.status}`);
    return res;
  } catch (error) {
    record(false, `[control] ${name}`, `error: ${error.message}`);
    return null;
  }
}

let markersB = [];
function leakedMarkers(text) { return markersB.filter((m) => m && text.includes(m)); }
function containsB(text) { return leakedMarkers(text).length > 0; }

function must(res, what) {
  if (!res || !ok(res.status)) throw new Error(`Setup failed (${what}): ${res?.status} ${res?.text?.slice(0, 300)}`);
  return res.json;
}

// ---------------------------------------------------------------------------------------------
// setup / cleanup
// ---------------------------------------------------------------------------------------------
async function cleanup() {
  const companies = `(select id from companies where name like '${COMPANY_PREFIX}%')`;
  const users = `(select id from "user" where email like '${EMAIL_PREFIX}%@example.com')`;
  await db.query("begin");
  try {
    // RESTRICT foreign keys first (visits->employees, *->user, divisions->work_schedules, events->file_assets)
    await db.query(`delete from visits where company_id in ${companies} or created_by in ${users}`);
    await db.query(`delete from attendance_events where company_id in ${companies} or recorded_by in ${users}`);
    await db.query(`delete from divisions where company_id in ${companies}`);
    await db.query(`delete from announcements where company_id in ${companies} or created_by in ${users}`);
    await db.query(`delete from feature_records where company_id in ${companies} or created_by in ${users}`);
    await db.query(`delete from file_assets where company_id in ${companies} or uploaded_by in ${users}`);
    await db.query(`delete from companies where name like '${COMPANY_PREFIX}%'`);
    await db.query(`delete from "user" where email like '${EMAIL_PREFIX}%@example.com'`);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function createCompany(letter) {
  const { rows: [company] } = await db.query(
    `insert into companies (name, industry, email) values ($1, 'Testing', $2) returning id, name`,
    [`${COMPANY_PREFIX}${letter}`, `zziso-${letter.toLowerCase()}@example.com`],
  );
  const hash = await hashPassword(PASSWORD);
  const people = {};
  for (const role of ["admin", "employee"]) {
    const userId = randomUUID().replaceAll("-", "");
    const email = `${EMAIL_PREFIX}${letter.toLowerCase()}-${role}@example.com`;
    const name = `ZZISO${letter} ${role === "admin" ? "Admin" : "Employee"}`;
    await db.query(`insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`, [userId, name, email]);
    await db.query(
      `insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, hash],
    );
    await db.query(`insert into company_members (company_id, user_id, role) values ($1, $2, $3)`, [company.id, userId, role]);
    const { rows: [emp] } = await db.query(
      `insert into employees (company_id, employee_code, name, email, department, position, joined_at, user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [company.id, `ZZISO${letter}-${role.toUpperCase()}`, name, email, `ZZISO${letter} Dept`, `ZZISO${letter} Staff`, "2025-01-01", userId],
    );
    people[role] = { userId, email, name, employeeId: emp.id };
  }
  return { id: company.id, name: company.name, letter, ...people };
}

/** Creates a full data set for one company via its own admin/employee API calls. */
async function seedCompanyData(c, admin, employee) {
  const L = c.letter;
  const d = {};
  const shift = must(await api(admin, "POST", "/api/master/shifts", { json: { name: `ZZISO${L} Shift`, graceMinutes: 10, active: true } }), "shift");
  d.shiftId = shift.row.id;
  must(await api(admin, "PUT", "/api/master/work-hours", { json: { scheduleId: d.shiftId, days: weekDays("08:00", "17:00") } }), "work-hours");
  d.divisionId = must(await api(admin, "POST", "/api/master/divisions", { json: { name: `ZZISO${L} Division`, scheduleId: d.shiftId, active: true } }), "division").row.id;
  d.positionId = must(await api(admin, "POST", "/api/master/positions", { json: { name: `ZZISO${L} Position`, active: true } }), "position").row.id;
  d.locationId = must(await api(admin, "POST", "/api/master/attendance-locations", { json: locationPayload(`ZZISO${L} Location`) }), "attendance location").row.id;
  const ann = must(await api(admin, "POST", "/api/announcements", { form: { title: `ZZISO${L} Announcement`, summary: `ZZISO${L} summary`, content: `ZZISO${L} content`, image: new Blob([PNG], { type: "image/png" }) } }), "announcement").row;
  d.announcementId = ann.id;
  d.announcementImageId = ann.imageAssetId;
  d.featureAdminId = must(await api(admin, "POST", "/api/feature-records", { json: { module: "karyawan/laporan-cuti", fields: { Catatan: `ZZISO${L} admin record` } } }), "feature record (admin)").record.id;
  d.featureEmpId = must(await api(employee, "POST", "/api/feature-records", { json: { module: "pengajuan/izin-cuti", fields: { Alasan: `ZZISO${L} employee record` } } }), "feature record (employee)").record.id;
  d.leaveId = must(await api(employee, "POST", "/api/leave-requests", { json: leavePayload(c.employee.employeeId, `ZZISO${L} leave reason`) }), "leave request").row.id;
  d.leaveId2 = must(await api(employee, "POST", "/api/leave-requests", { json: leavePayload(c.employee.employeeId, `ZZISO${L} leave reason 2`) }), "leave request 2").row.id;
  d.overtimeId = must(await api(employee, "POST", "/api/overtime-requests", { json: overtimePayload(c.employee.employeeId, `ZZISO${L} overtime`) }), "overtime request").row.id;
  d.overtimeId2 = must(await api(employee, "POST", "/api/overtime-requests", { json: overtimePayload(c.employee.employeeId, `ZZISO${L} overtime 2`) }), "overtime request 2").row.id;
  d.attendanceId = must(await api(admin, "POST", "/api/attendance/admin", { form: { employeeId: c.employee.employeeId, attendanceDate: today, checkInTime: "08:00", checkOutTime: "17:00", shiftId: d.shiftId, checkInLocationId: d.locationId, checkOutLocationId: d.locationId, status: "present", note: `ZZISO${L} attendance note` } }), "attendance").attendanceId;
  must(await api(admin, "POST", "/api/visits", { form: { employeeId: c.employee.employeeId, visitDate: today, visitTime: "10:00", outletName: `ZZISO${L} Outlet`, note: `ZZISO${L} visit note`, selfie: new Blob([PNG], { type: "image/png" }) } }), "visit");
  const { rows: [visit] } = await db.query(`select id from visits where company_id = $1 limit 1`, [c.id]);
  d.visitId = visit.id;
  const { rows: [visitFile] } = await db.query(`select id from file_assets where company_id = $1 and category = 'visit_attachment' limit 1`, [c.id]);
  d.visitFileId = visitFile?.id;
  const upload = must(await api(employee, "POST", "/api/feature-uploads", { form: { module: "pengajuan/izin-cuti", file: new Blob([PNG], { type: "image/png" }) } }), "feature upload");
  d.documentFileId = upload.id;
  return d;
}

function weekDays(start, end) {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, enabled: dayOfWeek <= 5, startTime: start, endTime: end }));
}
function locationPayload(name) {
  return { name, type: "branch", address: "Jl. ZZISO Test No. 1", latitude: -8.65, longitude: 115.21, radiusMeters: 100, active: true };
}
function leavePayload(employeeId, reason) {
  return { employeeId, type: "permission", startDate: shiftDate(today, 7), endDate: shiftDate(today, 8), reason };
}
function overtimePayload(employeeId, description) {
  return { employeeId, overtimeDate: shiftDate(today, 3), durationMinutes: 60, description };
}

// ---------------------------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------------------------
async function main() {
  await db.connect();
  console.log(`Tenant isolation test against ${BASE_URL}`);
  await cleanup(); // leftovers from a crashed run
  try {
    const A = await createCompany("A");
    const B = await createCompany("B");

    const sess = {};
    for (const [key, email] of [["aAdmin", A.admin.email], ["aEmp", A.employee.email], ["bAdmin", B.admin.email], ["bEmp", B.employee.email]]) {
      sess[key] = { cookie: await login(email) };
    }
    const { aAdmin, aEmp, bAdmin, bEmp } = sess;

    console.log("Seeding company data through the API ...");
    const a = await seedCompanyData(A, aAdmin, aEmp);
    const b = await seedCompanyData(B, bAdmin, bEmp);

    // Everything that identifies B. Names all start with "ZZISOB"; ids catch raw-id leaks.
    markersB = ["ZZISOB", B.id, B.admin.userId, B.employee.userId, B.admin.employeeId, B.employee.employeeId,
      ...Object.values(b).filter((v) => typeof v === "string")];

    const snap = (table, id) => () => snapshot(table, id);
    const daysSnap = (scheduleId) => () => snapshotQuery(`select * from work_schedule_days where schedule_id = $1 order by day_of_week`, [scheduleId]);
    const bAttendanceCount = () => snapshotQuery(`select id, check_in, check_out, status, note, shift_id from attendances where company_id = $1 order by id`, [B.id]);
    const superadminCookie = `tepatwaktu_superadmin_company=${B.id}`;

    console.log("\n== Positive controls (A on A's own data) ==");
    await allowed("PATCH /api/master/divisions/[A]", () => api(aAdmin, "PATCH", `/api/master/divisions/${a.divisionId}`, { json: { name: "ZZISOA Division Edited", scheduleId: a.shiftId, active: true } }));
    await allowed("PATCH /api/master/positions/[A]", () => api(aAdmin, "PATCH", `/api/master/positions/${a.positionId}`, { json: { name: "ZZISOA Position Edited", active: true } }));
    await allowed("PATCH /api/master/shifts/[A]", () => api(aAdmin, "PATCH", `/api/master/shifts/${a.shiftId}`, { json: { name: "ZZISOA Shift Edited", graceMinutes: 5, active: true } }));
    await allowed("PATCH /api/master/attendance-locations/[A]", () => api(aAdmin, "PATCH", `/api/master/attendance-locations/${a.locationId}`, { json: locationPayload("ZZISOA Location Edited") }));
    await allowed("GET /api/master/work-hours?scheduleId=[A]", () => api(aAdmin, "GET", `/api/master/work-hours?scheduleId=${a.shiftId}`), (r) => (r.json?.rows?.length === 7 ? null : "expected 7 days"));
    await allowed("PUT /api/master/work-hours (A schedule)", () => api(aAdmin, "PUT", "/api/master/work-hours", { json: { scheduleId: a.shiftId, days: weekDays("07:00", "16:00") } }));
    await allowed("GET /api/feature-records/[A]", () => api(aAdmin, "GET", `/api/feature-records/${a.featureAdminId}?module=karyawan/laporan-cuti`));
    await allowed("PATCH /api/feature-records/[A]", () => api(aAdmin, "PATCH", `/api/feature-records/${a.featureAdminId}`, { json: { module: "karyawan/laporan-cuti", fields: { Catatan: "ZZISOA edited" } } }));
    await allowed("GET /api/feature-records/[A-employee record] as A-employee", () => api(aEmp, "GET", `/api/feature-records/${a.featureEmpId}?module=pengajuan/izin-cuti`));
    await allowed("PATCH /api/announcements/[A]", () => api(aAdmin, "PATCH", `/api/announcements/${a.announcementId}`, { form: { title: "ZZISOA Announcement Edited", summary: "ZZISOA summary", content: "ZZISOA content" } }));
    await allowed("PATCH /api/leave-requests/[A]", () => api(aAdmin, "PATCH", `/api/leave-requests/${a.leaveId}`, { json: leavePayload(A.employee.employeeId, "ZZISOA leave edited") }));
    await allowed("PATCH /api/leave-requests/[A] as A-employee", () => api(aEmp, "PATCH", `/api/leave-requests/${a.leaveId}`, { json: leavePayload(A.employee.employeeId, "ZZISOA leave edited by employee") }));
    await allowed("PATCH /api/leave-requests/[A] action=pay", () => api(aAdmin, "PATCH", `/api/leave-requests/${a.leaveId}`, { json: { action: "pay", paid: true } }));
    await allowed("PATCH /api/overtime-requests/[A]", () => api(aAdmin, "PATCH", `/api/overtime-requests/${a.overtimeId}`, { json: overtimePayload(A.employee.employeeId, "ZZISOA overtime edited") }));
    await allowed("PATCH /api/overtime-requests/[A] as A-employee", () => api(aEmp, "PATCH", `/api/overtime-requests/${a.overtimeId}`, { json: overtimePayload(A.employee.employeeId, "ZZISOA overtime edited by employee") }));
    await allowed("PATCH /api/leave-requests (bulk review, A id)", () => api(aAdmin, "PATCH", "/api/leave-requests", { json: { ids: [a.leaveId2], status: "approved" } }), (r) => (r.json?.rows?.length === 1 ? null : "expected 1 updated row"));
    await allowed("PATCH /api/overtime-requests (bulk review, A id)", () => api(aAdmin, "PATCH", "/api/overtime-requests", { json: { ids: [a.overtimeId2], status: "approved" } }), (r) => (r.json?.rows?.length === 1 ? null : "expected 1 updated row"));
    await allowed("GET /api/files/[A announcement image]", () => api(aAdmin, "GET", `/api/files/${a.announcementImageId}`));
    await allowed("GET /api/files/[A employee document] as A-employee", () => api(aEmp, "GET", `/api/files/${a.documentFileId}`));
    if (a.visitFileId) await allowed("GET /api/files/[A visit photo]", () => api(aAdmin, "GET", `/api/files/${a.visitFileId}`));
    await allowed("GET /api/visits lists A's visit", () => api(aAdmin, "GET", "/api/visits"), (r) => (r.text.includes("ZZISOA Outlet") ? null : "A's own visit missing"));
    await allowed("GET /api/attendance/admin/export lists A's attendance", () => api(aAdmin, "GET", `/api/attendance/admin/export?date=${today}`), (r) => (r.text.includes("ZZISOA Employee") ? null : "A's own attendance missing"));
    await allowed("GET /api/master/divisions lists A's division", () => api(aAdmin, "GET", "/api/master/divisions"), (r) => (r.text.includes("ZZISOA Division") ? null : "A's division missing"));

    console.log("\n== Master data: A-admin on B's ids ==");
    await denied("PATCH /api/master/divisions/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/master/divisions/${b.divisionId}`, { json: { name: "ZZISOA Hacked Division", scheduleId: a.shiftId, active: false } }), snap("divisions", b.divisionId));
    await denied("DELETE /api/master/divisions/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/master/divisions/${b.divisionId}`), snap("divisions", b.divisionId));
    await denied("POST /api/master/divisions with B scheduleId (A-admin)", () => api(aAdmin, "POST", "/api/master/divisions", { json: { name: "ZZISOA Div On B Shift", scheduleId: b.shiftId, active: true } }), () => snapshotQuery(`select id from divisions where schedule_id = $1 order by id`, [b.shiftId]));
    await denied("PATCH /api/master/divisions/[A] with B scheduleId (A-admin)", () => api(aAdmin, "PATCH", `/api/master/divisions/${a.divisionId}`, { json: { name: "ZZISOA Division Edited", scheduleId: b.shiftId, active: true } }), () => snapshotQuery(`select id from divisions where schedule_id = $1 order by id`, [b.shiftId]));
    await denied("PATCH /api/master/positions/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/master/positions/${b.positionId}`, { json: { name: "ZZISOA Hacked Position", active: false } }), snap("job_positions", b.positionId));
    await denied("DELETE /api/master/positions/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/master/positions/${b.positionId}`), snap("job_positions", b.positionId));
    await denied("PATCH /api/master/shifts/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/master/shifts/${b.shiftId}`, { json: { name: "ZZISOA Hacked Shift", graceMinutes: 99, active: false } }), snap("work_schedules", b.shiftId));
    await denied("DELETE /api/master/shifts/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/master/shifts/${b.shiftId}`), snap("work_schedules", b.shiftId));
    await denied("PATCH /api/master/attendance-locations/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/master/attendance-locations/${b.locationId}`, { json: locationPayload("ZZISOA Hacked Location") }), snap("attendance_locations", b.locationId));
    await denied("DELETE /api/master/attendance-locations/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/master/attendance-locations/${b.locationId}`), snap("attendance_locations", b.locationId));
    await denied("GET /api/master/work-hours?scheduleId=[B] (A-admin)", () => api(aAdmin, "GET", `/api/master/work-hours?scheduleId=${b.shiftId}`), daysSnap(b.shiftId));
    await denied("PUT /api/master/work-hours scheduleId=[B] (A-admin)", () => api(aAdmin, "PUT", "/api/master/work-hours", { json: { scheduleId: b.shiftId, days: weekDays("01:00", "02:00") } }), daysSnap(b.shiftId));
    await denied("DELETE /api/master/work-hours?scheduleId=[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/master/work-hours?scheduleId=${b.shiftId}`), daysSnap(b.shiftId));
    for (const path of ["/api/master/divisions", "/api/master/positions", "/api/master/shifts", "/api/master/attendance-locations"]) {
      await noLeak(`GET ${path} (A-admin)`, () => api(aAdmin, "GET", path));
      await noLeak(`GET ${path}?companyId=B + superadmin company cookie (A-admin)`, () => api(aAdmin, "GET", `${path}?companyId=${B.id}`, { cookie: superadminCookie }));
    }
    await noLeak("GET /api/master/divisions (A-employee)", () => api(aEmp, "GET", "/api/master/divisions"), { requireOk: false });

    console.log("\n== Feature records ==");
    await denied("GET /api/feature-records/[B] (A-admin)", () => api(aAdmin, "GET", `/api/feature-records/${b.featureAdminId}?module=karyawan/laporan-cuti`), snap("feature_records", b.featureAdminId));
    await denied("PATCH /api/feature-records/[B] fields (A-admin)", () => api(aAdmin, "PATCH", `/api/feature-records/${b.featureAdminId}`, { json: { module: "karyawan/laporan-cuti", fields: { Catatan: "ZZISOA hacked" } } }), snap("feature_records", b.featureAdminId));
    await denied("PATCH /api/feature-records/[B] status (A-admin)", () => api(aAdmin, "PATCH", `/api/feature-records/${b.featureEmpId}`, { json: { module: "pengajuan/izin-cuti", status: "Disetujui" } }), snap("feature_records", b.featureEmpId));
    await denied("DELETE /api/feature-records/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/feature-records/${b.featureAdminId}?module=karyawan/laporan-cuti`), snap("feature_records", b.featureAdminId));
    await denied("GET /api/feature-records/[B-employee record] (A-employee)", () => api(aEmp, "GET", `/api/feature-records/${b.featureEmpId}?module=pengajuan/izin-cuti`), snap("feature_records", b.featureEmpId));
    await denied("PATCH /api/feature-records/[B-employee record] (A-employee)", () => api(aEmp, "PATCH", `/api/feature-records/${b.featureEmpId}`, { json: { module: "pengajuan/izin-cuti", fields: { Alasan: "ZZISOA hacked" } } }), snap("feature_records", b.featureEmpId));
    await denied("DELETE /api/feature-records/[B-employee record] (A-employee)", () => api(aEmp, "DELETE", `/api/feature-records/${b.featureEmpId}?module=pengajuan/izin-cuti`), snap("feature_records", b.featureEmpId));
    await noLeak("GET /api/feature-records?module=karyawan/laporan-cuti (A-admin)", () => api(aAdmin, "GET", "/api/feature-records?module=karyawan/laporan-cuti"));
    await noLeak("GET /api/feature-records?module=pengajuan/izin-cuti (A-admin)", () => api(aAdmin, "GET", `/api/feature-records?module=pengajuan/izin-cuti&companyId=${B.id}`, { cookie: superadminCookie }));
    await noLeak("GET /api/feature-records?module=pengajuan/izin-cuti (A-employee)", () => api(aEmp, "GET", "/api/feature-records?module=pengajuan/izin-cuti"));

    console.log("\n== Announcements ==");
    await denied("PATCH /api/announcements/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/announcements/${b.announcementId}`, { form: { title: "ZZISOA Hacked", summary: "ZZISOA hacked", content: "ZZISOA hacked" } }), snap("announcements", b.announcementId));
    await denied("DELETE /api/announcements/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/announcements/${b.announcementId}`), snap("announcements", b.announcementId));
    await denied("PATCH /api/announcements/[B] (A-employee)", () => api(aEmp, "PATCH", `/api/announcements/${b.announcementId}`, { form: { title: "ZZISOA Hacked", summary: "ZZISOA hacked", content: "ZZISOA hacked" } }), snap("announcements", b.announcementId));
    await noLeak("GET /api/announcements (A-admin)", () => api(aAdmin, "GET", "/api/announcements"));
    await noLeak("GET /api/announcements?q=ZZISOB (A-admin)", () => api(aAdmin, "GET", "/api/announcements?q=ZZISOB"));
    await noLeak("GET /api/announcements (A-employee)", () => api(aEmp, "GET", "/api/announcements"));

    console.log("\n== Files ==");
    for (const [label, id] of [["B announcement image", b.announcementImageId], ["B employee document", b.documentFileId], ["B visit photo", b.visitFileId]]) {
      if (!id) { record(false, `GET /api/files/[${label}]`, "setup did not produce this file"); continue; }
      await denied(`GET /api/files/[${label}] (A-admin)`, () => api(aAdmin, "GET", `/api/files/${id}`), snap("file_assets", id));
      await denied(`GET /api/files/[${label}] (A-employee)`, () => api(aEmp, "GET", `/api/files/${id}`), snap("file_assets", id));
    }

    console.log("\n== Leave requests ==");
    await denied("PATCH /api/leave-requests/[B] edit (A-admin)", () => api(aAdmin, "PATCH", `/api/leave-requests/${b.leaveId}`, { json: leavePayload(A.employee.employeeId, "ZZISOA hacked leave") }), snap("leave_requests", b.leaveId));
    await denied("PATCH /api/leave-requests/[B] action=review (A-admin)", () => api(aAdmin, "PATCH", `/api/leave-requests/${b.leaveId}`, { json: { action: "review", status: "approved" } }), snap("leave_requests", b.leaveId));
    await denied("PATCH /api/leave-requests/[B] action=pay (A-admin)", () => api(aAdmin, "PATCH", `/api/leave-requests/${b.leaveId}`, { json: { action: "pay", paid: true } }), snap("leave_requests", b.leaveId));
    await denied("DELETE /api/leave-requests/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/leave-requests/${b.leaveId}`), snap("leave_requests", b.leaveId));
    await denied("PATCH /api/leave-requests (bulk review with B ids) (A-admin)", async () => {
      const res = await api(aAdmin, "PATCH", "/api/leave-requests", { json: { ids: [b.leaveId, b.leaveId2], status: "rejected" } });
      // The bulk endpoint answers 200 with the rows it touched; only an empty result is a denial.
      return ok(res.status) && Array.isArray(res.json?.rows) && res.json.rows.length === 0 ? { ...res, status: 404 } : res;
    }, () => snapshotQuery(`select id, status from leave_requests where id = any($1) order by id`, [[b.leaveId, b.leaveId2]]));
    await denied("POST /api/leave-requests with B employeeId (A-admin)", () => api(aAdmin, "POST", "/api/leave-requests", { json: leavePayload(B.employee.employeeId, "ZZISOA leave for B employee") }), () => snapshotQuery(`select id from leave_requests where employee_id = $1 order by id`, [B.employee.employeeId]));
    await denied("PATCH /api/leave-requests/[B] edit (A-employee)", () => api(aEmp, "PATCH", `/api/leave-requests/${b.leaveId}`, { json: leavePayload(A.employee.employeeId, "ZZISOA hacked leave") }), snap("leave_requests", b.leaveId));
    await denied("DELETE /api/leave-requests/[B] (A-employee)", () => api(aEmp, "DELETE", `/api/leave-requests/${b.leaveId}`), snap("leave_requests", b.leaveId));
    await noLeak("GET /api/leave-requests (A-admin)", () => api(aAdmin, "GET", `/api/leave-requests?companyId=${B.id}`, { cookie: superadminCookie }));
    await noLeak("GET /api/leave-requests (A-employee)", () => api(aEmp, "GET", "/api/leave-requests"));

    console.log("\n== Overtime requests ==");
    await denied("PATCH /api/overtime-requests/[B] (A-admin)", () => api(aAdmin, "PATCH", `/api/overtime-requests/${b.overtimeId}`, { json: overtimePayload(A.employee.employeeId, "ZZISOA hacked overtime") }), snap("overtime_requests", b.overtimeId));
    await denied("DELETE /api/overtime-requests/[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/overtime-requests/${b.overtimeId}`), snap("overtime_requests", b.overtimeId));
    await denied("PATCH /api/overtime-requests (bulk review with B ids) (A-admin)", async () => {
      const res = await api(aAdmin, "PATCH", "/api/overtime-requests", { json: { ids: [b.overtimeId, b.overtimeId2], status: "rejected" } });
      return ok(res.status) && Array.isArray(res.json?.rows) && res.json.rows.length === 0 ? { ...res, status: 404 } : res;
    }, () => snapshotQuery(`select id, status from overtime_requests where id = any($1) order by id`, [[b.overtimeId, b.overtimeId2]]));
    await denied("POST /api/overtime-requests with B employeeId (A-admin)", () => api(aAdmin, "POST", "/api/overtime-requests", { json: overtimePayload(B.employee.employeeId, "ZZISOA overtime for B employee") }), () => snapshotQuery(`select id from overtime_requests where employee_id = $1 order by id`, [B.employee.employeeId]));
    await denied("PATCH /api/overtime-requests/[B] (A-employee)", () => api(aEmp, "PATCH", `/api/overtime-requests/${b.overtimeId}`, { json: overtimePayload(A.employee.employeeId, "ZZISOA hacked overtime") }), snap("overtime_requests", b.overtimeId));
    await denied("DELETE /api/overtime-requests/[B] (A-employee)", () => api(aEmp, "DELETE", `/api/overtime-requests/${b.overtimeId}`), snap("overtime_requests", b.overtimeId));
    await noLeak("GET /api/overtime-requests (A-admin)", () => api(aAdmin, "GET", "/api/overtime-requests"));
    await noLeak("GET /api/overtime-requests (A-employee)", () => api(aEmp, "GET", "/api/overtime-requests"));

    console.log("\n== Attendance ==");
    await denied("POST /api/attendance/admin companyId=B, B employee (A-admin)", () => api(aAdmin, "POST", "/api/attendance/admin", { form: { companyId: B.id, employeeId: B.employee.employeeId, attendanceDate: today, checkInTime: "06:00", status: "late", note: "ZZISOA hacked" } }), bAttendanceCount);
    await denied("POST /api/attendance/admin B employee, no companyId (A-admin)", () => api(aAdmin, "POST", "/api/attendance/admin", { form: { employeeId: B.employee.employeeId, attendanceDate: shiftDate(today, -2), checkInTime: "06:00", status: "late", note: "ZZISOA hacked" } }), bAttendanceCount);
    await denied("DELETE /api/attendance/admin?id=[B] (A-admin)", () => api(aAdmin, "DELETE", `/api/attendance/admin?id=${b.attendanceId}`), snap("attendances", b.attendanceId));
    await denied("DELETE /api/attendance/admin?id=[B] (A-employee)", () => api(aEmp, "DELETE", `/api/attendance/admin?id=${b.attendanceId}`), snap("attendances", b.attendanceId));
    await denied("GET /api/attendance/admin/export?companyId=B (A-admin)", () => api(aAdmin, "GET", `/api/attendance/admin/export?companyId=${B.id}&date=${today}`), snap("attendances", b.attendanceId));
    await denied("GET /api/attendance/admin/monthly/export?companyId=B (A-admin)", () => api(aAdmin, "GET", `/api/attendance/admin/monthly/export?companyId=${B.id}&year=${YEAR}&month=${MONTH}`), snap("attendances", b.attendanceId));
    await denied("POST /api/attendance/admin/monthly/import?companyId=B (A-admin)", () => api(aAdmin, "POST", `/api/attendance/admin/monthly/import?companyId=${B.id}`, { form: { file: new Blob([Buffer.from("not really xlsx")]) } }), bAttendanceCount);
    await denied("GET /api/attendance/admin/export (A-employee)", () => api(aEmp, "GET", `/api/attendance/admin/export?companyId=${B.id}&date=${today}`), snap("attendances", b.attendanceId));
    await noLeak("GET /api/attendance/admin/export (A-admin, own company)", () => api(aAdmin, "GET", `/api/attendance/admin/export?date=${today}`));
    await noLeak("GET /api/attendance/admin/monthly/export (A-admin, own company)", () => api(aAdmin, "GET", `/api/attendance/admin/monthly/export?year=${YEAR}&month=${MONTH}`));
    await noLeak("GET /api/attendance/admin/monthly/template (A-admin)", () => api(aAdmin, "GET", "/api/attendance/admin/monthly/template"));
    await noLeak("GET /api/attendance/me (A-employee)", () => api(aEmp, "GET", "/api/attendance/me"));

    // Cross-tenant references: A writes its own attendance but points shift/location at B's rows.
    try {
      const res = await api(aAdmin, "POST", "/api/attendance/admin", { form: { employeeId: A.employee.employeeId, attendanceDate: BUG_DATE, checkInTime: "08:00", checkOutTime: "17:00", shiftId: b.shiftId, checkInLocationId: b.locationId, checkOutLocationId: b.locationId, status: "present", note: "ZZISOA cross-ref probe" } });
      const { rows } = await db.query(
        `select a.shift_id, a.check_in_location_id, a.check_out_location_id,
                (select json_agg(e.location_id) from attendance_events e where e.attendance_id = a.id) as event_locations
         from attendances a where a.company_id = $1 and a.attendance_date = $2`, [A.id, BUG_DATE]);
      const row = rows[0];
      const refs = row ? [row.shift_id, row.check_in_location_id, row.check_out_location_id, ...(row.event_locations ?? [])] : [];
      const bad = refs.filter((v) => v === b.shiftId || v === b.locationId);
      record(!bad.length, "POST /api/attendance/admin with B shiftId/locationId on A employee (A-admin)",
        bad.length ? `status ${res.status}; A's attendance now references B's work_schedules/attendance_locations rows (${bad.length} refs)` : `status ${res.status}, no B references stored`);
    } catch (error) {
      record(false, "POST /api/attendance/admin with B shiftId/locationId on A employee (A-admin)", `error: ${error.message}`);
    }
    await noLeak("GET /api/attendance/admin/export after cross-ref probe (A-admin)", () => api(aAdmin, "GET", `/api/attendance/admin/export?date=${BUG_DATE}`));
    await noLeak("GET /api/attendance/admin/monthly/export after cross-ref probe (A-admin)", () => api(aAdmin, "GET", `/api/attendance/admin/monthly/export?year=${BUG_DATE.slice(0, 4)}&month=${Number(BUG_DATE.slice(5, 7))}`));

    console.log("\n== Visits ==");
    await denied("POST /api/visits with B employeeId (A-admin)", () => api(aAdmin, "POST", "/api/visits", { form: { employeeId: B.employee.employeeId, visitDate: today, visitTime: "11:00", outletName: "ZZISOA hacked visit" } }), () => snapshotQuery(`select id from visits where employee_id = $1 order by id`, [B.employee.employeeId]));
    await noLeak("GET /api/visits (A-admin)", () => api(aAdmin, "GET", `/api/visits?companyId=${B.id}`, { cookie: superadminCookie }));
    await noLeak("GET /api/visits (A-employee)", () => api(aEmp, "GET", "/api/visits"));
    await noLeak("GET /api/visits/export (A-admin)", () => api(aAdmin, "GET", `/api/visits/export?companyId=${B.id}`));
    await noLeak("GET /api/visits/photos (A-admin)", () => api(aAdmin, "GET", `/api/visits/photos?companyId=${B.id}`));
    await noLeak("GET /api/visits/export (A-employee)", () => api(aEmp, "GET", "/api/visits/export"), { requireOk: false });

    console.log("\n== Positive controls: deletes on A's own data ==");
    await allowed("DELETE /api/leave-requests/[A]", () => api(aAdmin, "DELETE", `/api/leave-requests/${a.leaveId}`), async () => ((await snapshot("leave_requests", a.leaveId)) === null ? null : "row still present"));
    await allowed("DELETE /api/overtime-requests/[A]", () => api(aAdmin, "DELETE", `/api/overtime-requests/${a.overtimeId}`), async () => ((await snapshot("overtime_requests", a.overtimeId)) === null ? null : "row still present"));
    await allowed("DELETE /api/feature-records/[A]", () => api(aAdmin, "DELETE", `/api/feature-records/${a.featureAdminId}?module=karyawan/laporan-cuti`), async () => ((await snapshot("feature_records", a.featureAdminId)) === null ? null : "row still present"));
    await allowed("DELETE /api/master/positions/[A]", () => api(aAdmin, "DELETE", `/api/master/positions/${a.positionId}`), async () => ((await snapshot("job_positions", a.positionId)) === null ? null : "row still present"));
    await allowed("DELETE /api/master/attendance-locations/[A]", () => api(aAdmin, "DELETE", `/api/master/attendance-locations/${a.locationId}`), async () => ((await snapshot("attendance_locations", a.locationId)) === null ? null : "row still present"));
    await allowed("DELETE /api/master/divisions/[A]", () => api(aAdmin, "DELETE", `/api/master/divisions/${a.divisionId}`), async () => ((await snapshot("divisions", a.divisionId)) === null ? null : "row still present"));
    await allowed("DELETE /api/attendance/admin?id=[A]", () => api(aAdmin, "DELETE", `/api/attendance/admin?id=${a.attendanceId}`), async () => ((await snapshot("attendances", a.attendanceId)) === null ? null : "row still present"));
    await allowed("DELETE /api/announcements/[A]", () => api(aAdmin, "DELETE", `/api/announcements/${a.announcementId}`), async () => ((await snapshot("announcements", a.announcementId)) === null ? null : "row still present"));

    // Final integrity sweep: every B row created above must still exist.
    const bRows = [["divisions", b.divisionId], ["job_positions", b.positionId], ["work_schedules", b.shiftId], ["attendance_locations", b.locationId],
      ["announcements", b.announcementId], ["feature_records", b.featureAdminId], ["feature_records", b.featureEmpId], ["leave_requests", b.leaveId],
      ["leave_requests", b.leaveId2], ["overtime_requests", b.overtimeId], ["overtime_requests", b.overtimeId2], ["attendances", b.attendanceId], ["visits", b.visitId]];
    const missing = [];
    for (const [table, id] of bRows) if ((await snapshot(table, id)) === null) missing.push(`${table}/${id}`);
    record(!missing.length, "All of B's rows still exist at the end", missing.length ? `missing: ${missing.join(", ")}` : `${bRows.length} rows intact`);
  } finally {
    // Purge all ZZISO rows. Uploaded test objects (1x1 PNGs) stay in object storage: no API deletes them.
    try { await cleanup(); console.log("\nCleanup done (ZZISO companies and users removed)."); }
    catch (error) { console.error("Cleanup failed:", error.message); }
    await db.end();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSummary: ${results.length - failed.length} passed, ${failed.length} failed, ${results.length} total`);
  if (failed.length) {
    console.log("Failed checks:");
    for (const f of failed) console.log(`  - ${f.name}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error("Test aborted:", error);
  process.exit(1);
});
