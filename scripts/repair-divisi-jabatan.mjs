/**
 * One-time data repair after migration 0054 (Divisi <-> Jabatan): that migration renamed the columns but
 * kept the values, so "Teknologi" shows as Jabatan and "Frontend Engineer" as Divisi. This script puts the
 * values under the right label and keeps every employee's work schedule exactly as it is.
 *
 *   node scripts/repair-divisi-jabatan.mjs                       preview every company, nothing is saved
 *   node scripts/repair-divisi-jabatan.mjs --company=<id>        preview one company
 *   node scripts/repair-divisi-jabatan.mjs --company=<id> --apply
 *   node scripts/repair-divisi-jabatan.mjs --company=all --apply
 *
 * Back up the database first. Only run it for companies whose data predates the swap: a company set up
 * afterwards already has the right values. A repaired company is remembered and never swapped twice.
 * When people of one new Jabatan had different schedules, the Jabatan is split as "Nama (Divisi)".
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

const MARKER = "repair_divisi_jabatan_v1";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const companyArg = args.find((arg) => arg.startsWith("--company="))?.slice(10);
if (apply && !companyArg) { console.error("--apply wajib disertai --company=<id> atau --company=all."); process.exit(1); }

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL tidak ditemukan.");
}

/** Schedule ids each active employee works on, as the app resolves them. */
async function effectiveSchedules(tx, companyId) {
  const { rows: [fallback] } = await tx.query(`select id from work_schedules where company_id=$1 and active order by created_at, id limit 1`, [companyId]);
  const { rows } = await tx.query(`select e.id,
      coalesce((select array_agg(ws.id::text order by ws.id) from job_positions p
        join job_position_schedules l on l.job_position_id=p.id
        join work_schedules ws on ws.id=l.schedule_id and ws.active
        where p.company_id=e.company_id and p.name=e.position and p.active), '{}') ids
    from employees e where e.company_id=$1 and e.status='active'`, [companyId]);
  return new Map(rows.map((row) => [row.id, (row.ids.length ? row.ids : fallback ? [fallback.id] : []).join(",")]));
}

async function repairCompany(tx, company) {
  const before = await effectiveSchedules(tx, company.id);
  const { rows: people } = await tx.query(`select id, position, department, status from employees where company_id=$1`, [company.id]);
  const { rows: oldPositions } = await tx.query(`select id, name, active from job_positions where company_id=$1`, [company.id]);
  const { rows: oldDivisions } = await tx.query(`select name, active from divisions where company_id=$1`, [company.id]);
  const { rows: oldLinks } = await tx.query(`select l.job_position_id, l.schedule_id, l.position from job_position_schedules l join job_positions p on p.id=l.job_position_id where p.company_id=$1 order by l.position`, [company.id]);
  const byName = new Map(oldPositions.map((row) => [row.name, row]));
  // An inactive old jabatan gave no schedule, so its people keep the company's default.
  const linksOf = (name) => { const row = byName.get(name); return row?.active ? oldLinks.filter((link) => link.job_position_id === row.id).map((link) => link.schedule_id) : []; };

  const groups = new Map();
  for (const person of people) {
    const list = groups.get(person.department) ?? [];
    list.push(person);
    groups.set(person.department, list);
  }
  const newPositions = new Map();
  const assignment = new Map();
  const split = [];
  for (const [title, members] of groups) {
    const variants = new Set(members.map((member) => linksOf(member.position).join(",")));
    for (const member of members) {
      const name = variants.size > 1 ? `${title} (${member.position})` : title;
      if (name.length > 80) throw new Error(`Nama jabatan terlalu panjang: ${name}`);
      if (variants.size > 1 && !split.includes(name)) split.push(name);
      assignment.set(member.id, name);
      const entry = newPositions.get(name) ?? { active: false, links: linksOf(member.position) };
      if (member.status === "active") entry.active = true;
      newPositions.set(name, entry);
    }
  }
  for (const division of oldDivisions) if (!groups.has(division.name)) newPositions.set(division.name, { active: division.active, links: [] });
  for (const [name, entry] of newPositions) {
    const old = oldDivisions.find((division) => division.name === name);
    if (old?.active) entry.active = true;
  }
  const newDivisions = new Map(oldPositions.map((row) => [row.name, row.active]));
  for (const person of people) if (!newDivisions.has(person.position)) newDivisions.set(person.position, true);
  for (const person of people) if (person.status === "active") newDivisions.set(person.position, true);

  await tx.query(`delete from job_positions where company_id=$1`, [company.id]);
  await tx.query(`delete from divisions where company_id=$1`, [company.id]);
  for (const [name, active] of newDivisions) await tx.query(`insert into divisions (company_id, name, active) values ($1,$2,$3)`, [company.id, name, active]);
  for (const [name, entry] of newPositions) {
    const { rows: [row] } = await tx.query(`insert into job_positions (company_id, name, schedule_id, active) values ($1,$2,$3,$4) returning id`, [company.id, name, entry.links[0] ?? null, entry.active]);
    for (const [order, scheduleId] of entry.links.entries()) await tx.query(`insert into job_position_schedules (job_position_id, schedule_id, position) values ($1,$2,$3)`, [row.id, scheduleId, order]);
  }
  for (const person of people) await tx.query(`update employees set department=$2, position=$3 where id=$1`, [person.id, person.position, assignment.get(person.id)]);

  const after = await effectiveSchedules(tx, company.id);
  const changed = [...before].filter(([id, value]) => after.get(id) !== value);
  if (changed.length) throw new Error(`${company.name}: jadwal ${changed.length} karyawan akan berubah, perbaikan dibatalkan.`);
  return { employees: people.length, positions: newPositions.size, divisions: newDivisions.size, split, sample: people.slice(0, 3).map((person) => `${person.position} / ${person.department} -> Divisi ${person.position}, Jabatan ${assignment.get(person.id)}`) };
}

const db = new pg.Client({ connectionString: databaseUrl() });
await db.connect();
try {
  const { rows: [stored] } = await db.query(`select value from platform_settings where key=$1`, [MARKER]);
  const done = new Set(stored ? JSON.parse(stored.value) : []);
  const { rows: companies } = await db.query(`select id, name from companies order by name`);
  const targets = companies.filter((company) => !companyArg || companyArg === "all" || company.id === companyArg);
  if (companyArg && companyArg !== "all" && !targets.length) throw new Error("Perusahaan tidak ditemukan.");
  for (const company of targets) {
    if (done.has(company.id)) { console.log(`- ${company.name}: sudah diperbaiki, dilewati`); continue; }
    await db.query("begin");
    try {
      const result = await repairCompany(db, company);
      if (apply) {
        done.add(company.id);
        await db.query(`insert into platform_settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value, updated_at=now()`, [MARKER, JSON.stringify([...done])]);
        await db.query("commit");
      } else await db.query("rollback");
      console.log(`${apply ? "DIPERBAIKI" : "PRATINJAU"} ${company.name}: ${result.employees} karyawan, ${result.positions} jabatan, ${result.divisions} divisi${result.split.length ? `, jabatan dipisah: ${result.split.join("; ")}` : ""}`);
      for (const line of result.sample) console.log(`    ${line}`);
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  if (!apply) console.log("Belum ada yang disimpan. Tambahkan --company=<id> --apply untuk menerapkan.");
} finally {
  await db.end();
}
