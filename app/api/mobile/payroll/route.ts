import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { getPayrollRules, payrollRulesSchema, savePayrollRules } from "@/features/payslips/server/payroll-settings";
import { finalizePayslips, getPayslip, listPayslips, unlockPayslip } from "@/features/payslips/server/payslip-service";

export const runtime = "nodejs";
const period = z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12) });
async function contextFor(request: Request) {
  const context = await selfAttendanceContext(request);
  if (!["hrd", "general_manager"].includes(context.role)) throw new AttendanceError("Akses penggajian ditolak.", 403);
  return context;
}
function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile payroll failed", error);
  return Response.json({ error: "Penggajian belum dapat diproses." }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const context = await contextFor(request);
    const params = new URL(request.url).searchParams;
    if (params.get("settings") === "1") return Response.json({ row: await getPayrollRules(context.companyId) });
    const parsed = period.safeParse(Object.fromEntries(params));
    if (!parsed.success) return Response.json({ error: "Periode tidak valid." }, { status: 400 });
    const employeeId = params.get("employeeId");
    if (employeeId) {
      const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.id, employeeId))).limit(1);
      if (!employee) return Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
      return Response.json({ row: await getPayslip(context.companyId, employee.id, parsed.data.year, parsed.data.month) });
    }
    return Response.json({ rows: await listPayslips(context.companyId, parsed.data.year, parsed.data.month) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await contextFor(request);
    const parsed = period.extend({ employeeIds: z.array(z.uuid()).min(1).max(500) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Data slip gaji tidak valid." }, { status: 400 });
    const owned = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), inArray(employees.id, parsed.data.employeeIds)));
    const count = await finalizePayslips(context.companyId, owned.map((row) => row.id), parsed.data.year, parsed.data.month, context.userId);
    return Response.json({ count });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    const context = await contextFor(request);
    const parsed = period.extend({ employeeId: z.uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Data slip gaji tidak valid." }, { status: 400 });
    const count = await unlockPayslip(context.companyId, parsed.data.employeeId, parsed.data.year, parsed.data.month);
    return Response.json({ count });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    const context = await contextFor(request);
    const parsed = payrollRulesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Pengaturan tidak valid." }, { status: 400 });
    await savePayrollRules(context.companyId, parsed.data, context.userId);
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
