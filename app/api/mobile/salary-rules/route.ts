import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeSalaryProfiles, employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";

export const runtime = "nodejs";

const money = z.number().int().min(0).max(100_000_000_000);
const basicsSchema = z.object({ kind: z.literal("basics"), employeeId: z.uuid(), baseSalary: money, overtimeRate: money, salaryBasis: z.enum(["monthly", "daily", "hourly"]) });
const ruleSchema = z.object({
  kind: z.literal("rule"), employeeId: z.uuid(),
  absentRule: z.enum(["company", "manual_only"]), absentManualAmount: money,
  lateRule: z.enum(["company", "none", "custom"]), lateMode: z.enum(["per_minute", "per_hour", "per_day"]), lateAmount: money,
});

async function contextFor(request: Request) {
  const context = await selfAttendanceContext(request);
  if (!["hrd", "general_manager"].includes(context.role)) throw new AttendanceError("Akses aturan gaji ditolak.", 403);
  return context;
}

function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile salary rules failed", error);
  return Response.json({ error: "Aturan gaji belum dapat diproses." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await contextFor(request);
    const rows = await db.select({
      employeeId: employees.id, name: employees.name, position: employees.position, department: employees.department,
      baseSalary: employeeSalaryProfiles.baseSalary, overtimeRate: employeeSalaryProfiles.overtimeRate, salaryBasis: employeeSalaryProfiles.salaryBasis,
      absentRule: employeeSalaryProfiles.absentRule, absentManualAmount: employeeSalaryProfiles.absentManualAmount,
      lateRule: employeeSalaryProfiles.lateRule, lateMode: employeeSalaryProfiles.lateMode, lateAmount: employeeSalaryProfiles.lateAmount,
    }).from(employees).leftJoin(employeeSalaryProfiles, eq(employeeSalaryProfiles.employeeId, employees.id))
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name));
    return Response.json({ rows: rows.map((row) => ({
      ...row, baseSalary: row.baseSalary ?? 0, overtimeRate: row.overtimeRate ?? 0, salaryBasis: row.salaryBasis ?? "monthly",
      absentRule: row.absentRule ?? "company", absentManualAmount: row.absentManualAmount ?? 0,
      lateRule: row.lateRule ?? "company", lateMode: row.lateMode ?? "per_day", lateAmount: row.lateAmount ?? 0,
    })) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const context = await contextFor(request);
    const parsed = z.discriminatedUnion("kind", [basicsSchema, ruleSchema]).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Aturan gaji tidak valid." }, { status: 400 });
    const { employeeId } = parsed.data;
    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId))).limit(1);
    if (!employee) return Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
    const values = parsed.data.kind === "basics"
      ? { baseSalary: parsed.data.baseSalary, overtimeRate: parsed.data.overtimeRate, salaryBasis: parsed.data.salaryBasis }
      : { absentRule: parsed.data.absentRule, absentManualAmount: parsed.data.absentRule === "manual_only" ? parsed.data.absentManualAmount : 0,
          lateRule: parsed.data.lateRule, lateMode: parsed.data.lateMode, lateAmount: parsed.data.lateRule === "custom" ? parsed.data.lateAmount : 0 };
    await db.insert(employeeSalaryProfiles).values({ companyId: context.companyId, employeeId, ...values })
      .onConflictDoUpdate({ target: employeeSalaryProfiles.employeeId, set: { ...values, updatedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
