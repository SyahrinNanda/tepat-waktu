import "./env";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { auth } from "../lib/auth";
import { db, pool } from "../db";
import { account as authAccount, attendanceLocations, attendances, companies, companyMembers, divisions, employees, jobPositions, leaveRequests, subscriptionPlans, user, visitLocations, workScheduleDays, workSchedules } from "../db/schema";

const DEMO_EMAIL = "admin@tepatwaktu.id";
const DEMO_PASSWORD = "TepatWaktu123!";
const SUPERADMIN_EMAIL = "superadmin@tepatwaktu.id";

const LEGACY_DEMO_EMAILS = [
  ["superadmin@attenda.id", "superadmin@tepatwaktu.id"],
  ["admin@attenda.id", "admin@tepatwaktu.id"],
  ["andi@attenda.id", "andi@tepatwaktu.id"],
  ["salsa@attenda.id", "salsa@tepatwaktu.id"],
  ["raka@attenda.id", "raka@tepatwaktu.id"],
  ["maya@attenda.id", "maya@tepatwaktu.id"],
  ["bima@attenda.id", "bima@tepatwaktu.id"],
] as const;

async function migrateLegacyDemoEmails() {
  for (const [legacyEmail, currentEmail] of LEGACY_DEMO_EMAILS) {
    const [legacyUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, legacyEmail)).limit(1);
    const [currentUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, currentEmail)).limit(1);
    if (legacyUser && !currentUser) {
      await db.update(user).set({ email: currentEmail }).where(eq(user.id, legacyUser.id));
    }
    await db.update(employees).set({ email: currentEmail }).where(eq(employees.email, legacyEmail));
  }
}

async function setDemoPassword(userId: string, passwordHash: string) {
  await db
    .update(authAccount)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(and(eq(authAccount.userId, userId), eq(authAccount.providerId, "credential")));
}

function dateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

async function main() {
  await migrateLegacyDemoEmails();
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);

  const plans = [
    ["free", "Free Trial", 0, 5, 14, false, "Coba seluruh fitur gratis selama 14 hari"],
    ["micro", "Micro", 97000, 10, 0, false, "Untuk usaha mikro hingga 10 karyawan"],
    ["small", "Small", 237000, 25, 0, false, "Untuk usaha kecil hingga 25 karyawan"],
    ["growth", "Growth", 458000, 50, 0, true, "Untuk perusahaan yang sedang bertumbuh hingga 50 karyawan"],
    ["mid-size", "Mid-size", 872000, 100, 0, false, "Untuk perusahaan menengah hingga 100 karyawan"],
    ["expand", "Expand", 1648000, 200, 0, false, "Untuk perusahaan yang berekspansi hingga 200 karyawan"],
    ["pro", "Pro", 3849000, 500, 0, false, "Untuk perusahaan besar hingga 500 karyawan"],
    ["enterprise", "Enterprise", 7150000, 1000, 0, false, "Untuk korporasi hingga 1.000 karyawan"],
  ] as const;
  for (const [code, name, monthlyPrice, maxEmployees, trialDays, recommended, description] of plans) {
    await db.insert(subscriptionPlans).values({ code, name, monthlyPrice, maxEmployees, trialDays, trialMonths: 0, recommended, description }).onConflictDoUpdate({ target: subscriptionPlans.code, set: { name, monthlyPrice, maxEmployees, trialDays, trialMonths: 0, recommended, description, active: true, companyId: null } });
  }
  await db.update(subscriptionPlans).set({ active: false, recommended: false }).where(and(isNull(subscriptionPlans.companyId), notInArray(subscriptionPlans.code, plans.map(([code]) => code))));
  let [superadmin] = await db.select({ id: user.id }).from(user).where(eq(user.email, SUPERADMIN_EMAIL)).limit(1);
  if (!superadmin) {
    await auth.api.signUpEmail({ body: { name: "Super Admin TepatWaktu", email: SUPERADMIN_EMAIL, password: DEMO_PASSWORD } });
    [superadmin] = await db.select({ id: user.id }).from(user).where(eq(user.email, SUPERADMIN_EMAIL)).limit(1);
  }
  if (superadmin) {
      await db.update(user).set({ name: "Super Admin TepatWaktu", platformRole: "superadmin", emailVerified: true }).where(eq(user.id, superadmin.id));
    await setDemoPassword(superadmin.id, demoPasswordHash);
  }

  let [demoUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (!demoUser) {
    await auth.api.signUpEmail({ body: { name: "Nadia Pratama", email: DEMO_EMAIL, password: DEMO_PASSWORD } });
    [demoUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  }
  if (!demoUser) throw new Error("Gagal membuat pengguna demo.");
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, demoUser.id));
  await setDemoPassword(demoUser.id, demoPasswordHash);

  let [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, demoUser.id)).limit(1);
  if (!membership) {
    const [company] = await db.insert(companies).values({ name: "Nusantara Kreatif", industry: "Teknologi", plan: "growth" }).returning({ id: companies.id });
    await db.insert(companyMembers).values({ companyId: company.id, userId: demoUser.id, role: "admin" });
    membership = { companyId: company.id };
  }

  const [existing] = await db.select({ id: employees.id }).from(employees).where(eq(employees.companyId, membership.companyId)).limit(1);
  if (!existing) {
    const team = await db.insert(employees).values([
      { companyId: membership.companyId, employeeCode: "EMP-001", name: "Andi Saputra", email: "andi@tepatwaktu.id", department: "Operasional", position: "Supervisor", gender: "male", joinedAt: dateOffset(-240) },
      { companyId: membership.companyId, employeeCode: "EMP-002", name: "Salsa Kirana", email: "salsa@tepatwaktu.id", department: "People", position: "HR Specialist", gender: "female", joinedAt: dateOffset(-180) },
      { companyId: membership.companyId, employeeCode: "EMP-003", name: "Raka Wijaya", email: "raka@tepatwaktu.id", department: "Teknologi", position: "Frontend Engineer", gender: "male", joinedAt: dateOffset(-120) },
      { companyId: membership.companyId, employeeCode: "EMP-004", name: "Maya Lestari", email: "maya@tepatwaktu.id", department: "Keuangan", position: "Finance Officer", gender: "female", joinedAt: dateOffset(-75) },
      { companyId: membership.companyId, employeeCode: "EMP-005", name: "Bima Aditya", email: "bima@tepatwaktu.id", department: "Teknologi", position: "Backend Engineer", gender: "male", joinedAt: dateOffset(-40) },
    ]).returning({ id: employees.id });

    await db.insert(workSchedules).values({ companyId: membership.companyId, name: "Reguler kantor", workDays: "Senin–Jumat", startTime: "08:00:00", endTime: "17:00:00", graceMinutes: 15 });
    await db.insert(attendances).values([
      { companyId: membership.companyId, employeeId: team[0].id, attendanceDate: dateOffset(0), checkIn: "07:52:00", status: "present" },
      { companyId: membership.companyId, employeeId: team[1].id, attendanceDate: dateOffset(0), checkIn: "08:03:00", status: "present" },
      { companyId: membership.companyId, employeeId: team[2].id, attendanceDate: dateOffset(0), checkIn: "08:24:00", status: "late", note: "Kendala perjalanan" },
      { companyId: membership.companyId, employeeId: team[3].id, attendanceDate: dateOffset(0), checkIn: "07:58:00", status: "present" },
    ]);
    await db.insert(leaveRequests).values({ companyId: membership.companyId, employeeId: team[4].id, type: "annual", startDate: dateOffset(3), endDate: dateOffset(4), reason: "Keperluan keluarga", status: "pending" });
  }

  let [defaultShift] = await db.select().from(workSchedules).where(and(eq(workSchedules.companyId, membership.companyId), eq(workSchedules.name, "Reguler kantor"))).limit(1);
  if (!defaultShift) [defaultShift] = await db.insert(workSchedules).values({ companyId: membership.companyId, name: "Reguler kantor", workDays: "1,2,3,4,5", startTime: "08:00:00", endTime: "17:00:00", graceMinutes: 15, active: true }).returning();
  for (let day = 1; day <= 7; day++) await db.insert(workScheduleDays).values({ scheduleId: defaultShift.id, dayOfWeek: day, enabled: day <= 5, startTime: "08:00:00", endTime: day === 5 ? "16:00:00" : "17:00:00" }).onConflictDoNothing({ target: [workScheduleDays.scheduleId, workScheduleDays.dayOfWeek] });
  for (const name of ["Operasional", "People", "Teknologi", "Keuangan"]) await db.insert(divisions).values({ companyId: membership.companyId, name, scheduleId: defaultShift.id, active: true }).onConflictDoNothing({ target: [divisions.companyId, divisions.name] });
  for (const name of ["Supervisor", "HR Specialist", "Frontend Engineer", "Finance Officer", "Backend Engineer"]) await db.insert(jobPositions).values({ companyId: membership.companyId, name }).onConflictDoNothing({ target: [jobPositions.companyId, jobPositions.name] });
  await db.insert(attendanceLocations).values({ companyId: membership.companyId, name: "Kantor Pusat", type: "headquarters", address: "Yogyakarta", latitude: -7.7956, longitude: 110.3695, radiusMeters: 100 }).onConflictDoNothing({ target: [attendanceLocations.companyId, attendanceLocations.name] });
  await db.insert(visitLocations).values({ companyId: membership.companyId, name: "Mitra Sejahtera", ownerName: "Budi Santoso", email: "mitra@example.com", phone: "081234567890", address: "Yogyakarta", latitude: -7.8014, longitude: 110.3647, radiusMeters: 100 }).onConflictDoNothing({ target: [visitLocations.companyId, visitLocations.name] });

  const roleAccounts = [
    { email: "andi@tepatwaktu.id", name: "Andi Saputra", role: "general_manager" as const, gender: "male" as const },
    { email: "salsa@tepatwaktu.id", name: "Salsa Kirana", role: "hrd" as const, gender: "female" as const },
    { email: "raka@tepatwaktu.id", name: "Raka Wijaya", role: "manager" as const, gender: "male" as const },
    { email: "maya@tepatwaktu.id", name: "Maya Lestari", role: "employee" as const, gender: "female" as const },
    { email: "bima@tepatwaktu.id", name: "Bima Aditya", role: "employee" as const, gender: "male" as const },
  ];
  for (const account of roleAccounts) {
    let [accountUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, account.email)).limit(1);
    if (!accountUser) {
      await auth.api.signUpEmail({ body: { name: account.name, email: account.email, password: DEMO_PASSWORD } });
      [accountUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, account.email)).limit(1);
    }
    if (!accountUser) throw new Error(`Gagal membuat akun ${account.email}.`);
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, accountUser.id));
    await setDemoPassword(accountUser.id, demoPasswordHash);
    await db.insert(companyMembers).values({ companyId: membership.companyId, userId: accountUser.id, role: account.role }).onConflictDoUpdate({
      target: [companyMembers.companyId, companyMembers.userId],
      set: { role: account.role },
    });
    await db.update(employees).set({ userId: accountUser.id, gender: account.gender }).where(and(eq(employees.companyId, membership.companyId), eq(employees.email, account.email)));
  }

  console.log("Seed selesai.");
  console.log(`Login demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Login superadmin: ${SUPERADMIN_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Login karyawan: bima@tepatwaktu.id / ${DEMO_PASSWORD}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
