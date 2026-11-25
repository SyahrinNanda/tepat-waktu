/**
 * Check-in / check-out for a shift that ends after midnight (e.g. 19:00-01:00 at a 24-hour station).
 * Writes test rows, so run it against a copy of the database:
 *   DATABASE_URL=postgresql://.../tepatwaktu_qa npx tsx scripts/test-overnight-shift.ts
 */
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { attendanceEvents, attendances, companies, companyMembers, employees, positionSchedules, positions, workScheduleDays, workSchedules } from "@/db/schema";
import { currentAttendance, getSelfAttendanceStatus, recordAttendanceEvent, type SelfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { fetchMonthlyAttendanceSummary } from "@/features/attendance/server/monthly-service";

if (!process.env.DATABASE_URL?.includes("_qa")) { console.error("Jalankan di salinan database (nama berakhiran _qa)."); process.exit(1); }

let passed = 0, failed = 0;
function check(ok: boolean, name: string, detail = "") { if (ok) passed++; else failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`); }

/** Local "YYYY-MM-DD HH:MM" in a time zone -> the UTC instant. */
function at(timezone: string, date: string, time: string) {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const shown = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    guess += wanted - shown;
  }
  return new Date(guess);
}

async function main() {
  const [company] = await db.select({ id: companies.id, name: companies.name, timezone: companies.timezone }).from(companies).where(eq(companies.name, "Nusantara Kreatif")).limit(1);
  const tz = company.timezone;
  const [actor] = await db.select({ id: companyMembers.userId }).from(companyMembers).where(and(eq(companyMembers.companyId, company.id), eq(companyMembers.role, "admin"))).limit(1);
  await db.delete(employees).where(and(eq(employees.companyId, company.id), like(employees.email, "zz-overnight-%")));
  await db.delete(positions).where(and(eq(positions.companyId, company.id), like(positions.name, "ZZ Overnight%")));
  await db.delete(workSchedules).where(and(eq(workSchedules.companyId, company.id), like(workSchedules.name, "ZZ Overnight%")));

  async function setup(label: string, start: string, end: string) {
    const [schedule] = await db.insert(workSchedules).values({ companyId: company.id, name: `ZZ Overnight ${label}`, workDays: "Setiap hari", startTime: start, endTime: end, graceMinutes: 10, active: true }).returning();
    for (let day = 1; day <= 7; day++) await db.insert(workScheduleDays).values({ scheduleId: schedule.id, dayOfWeek: day, enabled: true, startTime: start, endTime: end });
    const [position] = await db.insert(positions).values({ companyId: company.id, name: `ZZ Overnight ${label}`, scheduleId: schedule.id, active: true }).returning();
    await db.insert(positionSchedules).values({ positionId: position.id, scheduleId: schedule.id, sortOrder: 0 });
    const [employee] = await db.insert(employees).values({ companyId: company.id, employeeCode: `ZZ-ON-${label}`, name: `ZZ Overnight ${label}`, email: `zz-overnight-${label.toLowerCase()}@example.test`, position: position.name, department: "Umum", joinedAt: "2026-11-01", lockLocation: false, lockPhoto: false }).returning();
    const context = { userId: "zz", email: employee.email, platformRole: "user", companyId: company.id, companyName: company.name, timezone: tz, role: "employee", employeeId: employee.id, employeeName: employee.name } as unknown as SelfAttendanceContext;
    const act = (action: "check_in" | "check_out", date: string, time: string) => recordAttendanceEvent({ actorId: actor.id, companyId: company.id, employeeId: employee.id, timezone: tz, action, source: "admin", occurredAt: at(tz, date, time) });
    const status = (date: string, time: string) => getSelfAttendanceStatus(context, at(tz, date, time));
    const row = async (date: string) => (await db.select().from(attendances).where(and(eq(attendances.employeeId, employee.id), eq(attendances.attendanceDate, date))).limit(1))[0];
    return { employee, act, status, row };
  }

  // A night shift 19:00-01:00.
  const night = await setup("Malam", "19:00:00", "01:00:00");
  await night.act("check_in", "2026-11-23", "18:55");
  let s = await night.status("2026-11-24", "00:30");
  check(s.nextAction === "check_out", "00:30: shift malam yang belum pulang masih menunggu check-out", String(s.nextAction));
  s = await night.status("2026-11-24", "01:05");
  check(s.nextAction === "check_out" && s.attendance?.checkIn?.startsWith("18:55") === true, "01:05: tombol yang tersedia Check-out, bukan Check-in", JSON.stringify({ next: s.nextAction, in: s.attendance?.checkIn }));
  let failure = "";
  const out = await night.act("check_out", "2026-11-24", "01:05").catch((error: Error) => { failure = error.message; return null; });
  const first = await night.row("2026-11-23");
  check(out?.date === "2026-11-23" && first?.checkOut?.startsWith("01:05") === true, "Check-out 01:05 menutup kehadiran tanggal 23", failure || JSON.stringify(first));
  check(!(await night.row("2026-11-24")), "Tidak ada kehadiran baru yang terbuka di tanggal 24");
  const [report] = await fetchMonthlyAttendanceSummary({ companyId: company.id, year: 2026, month: 11, query: "ZZ-ON-Malam" });
  check(report?.jamAktualMinutes === 310 && report.jamKerjaMinutes === 300 && report.terlambatMinutes === 0 && report.lemburMinutes === 5, "Laporan Bulanan: 18:55-01:05 = 5 jam 10 menit kerja aktual, jadwal 5 jam, lembur 5 menit", JSON.stringify({ aktual: report?.jamAktualMinutes, jadwal: report?.jamKerjaMinutes, telat: report?.terlambatMinutes, lembur: report?.lemburMinutes, awal: report?.pulangAwalMinutes }));
  s = await night.status("2026-11-24", "01:30");
  check(s.nextAction === null, "Setelah check-out, hari itu selesai", String(s.nextAction));
  s = await night.status("2026-11-24", "18:50");
  check(s.nextAction === "check_in", "Sore berikutnya bisa check-in lagi untuk shift tanggal 24", String(s.nextAction));

  // Forgot to check out: the open night closes for check-out only until 6 hours after the shift end.
  await night.act("check_in", "2026-11-24", "19:00");
  s = await night.status("2026-11-25", "06:30");
  check(s.nextAction === "check_out", "06:30 (masih dalam 6 jam setelah jam pulang): masih bisa check-out", String(s.nextAction));
  const home = await currentAttendance({ companyId: company.id, employeeId: night.employee.id, timezone: tz, now: at(tz, "2026-11-25", "01:10") });
  check(home?.checkIn?.startsWith("19:00") === true && !home.checkOut, "Beranda 01:10: kartu absen menampilkan shift malam yang menunggu check-out", JSON.stringify(home));
  s = await night.status("2026-11-25", "07:30");
  check(s.nextAction === "check_in" && !s.attendance, "07:30 (lewat 6 jam): kembali ke Check-in hari baru", String(s.nextAction));

  // A day shift is not affected: a forgotten check-out stays on its own day.
  const day = await setup("Pagi", "08:00:00", "17:00:00");
  await day.act("check_in", "2026-11-23", "08:00");
  s = await day.status("2026-11-24", "00:30");
  check(s.nextAction === "check_in" && !s.attendance, "Shift pagi lupa check-out: lewat tengah malam tetap Check-in baru", String(s.nextAction));
  failure = "";
  await day.act("check_out", "2026-11-24", "00:30").catch((error: Error) => { failure = error.message; });
  check(/Check-in harus dicatat/.test(failure), "Shift pagi: check-out lewat tengah malam tidak menutup hari kemarin", failure);

  for (const item of [night, day]) {
    await db.delete(attendanceEvents).where(eq(attendanceEvents.employeeId, item.employee.id));
    await db.delete(attendances).where(eq(attendances.employeeId, item.employee.id));
    await db.delete(employees).where(eq(employees.id, item.employee.id));
  }
  await db.delete(positions).where(and(eq(positions.companyId, company.id), like(positions.name, "ZZ Overnight%")));
  await db.delete(workSchedules).where(and(eq(workSchedules.companyId, company.id), like(workSchedules.name, "ZZ Overnight%")));
  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed ? 1 : 0);
}
main().catch((error) => { console.error(error); process.exit(1); });
