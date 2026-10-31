import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { divisions, employees, overtimeRequests, workSchedules } from "@/db/schema";
import { canReviewRequests, employeeRequestContext, revalidateRequestPaths, selectableEmployee } from "@/features/employee-requests/server/request-context";

export const overtimeInput = z.object({ employeeId: z.uuid(), overtimeDate: z.iso.date(), durationMinutes: z.number().int().min(15).max(1440), description: z.string().trim().min(3).max(500) });
const path = "/dashboard/pengajuan/lembur";

export async function GET(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/lembur", "read"); if ("error" in context) return context.error;
  const canReview = canReviewRequests(context.role);
  const rows = await db.select({ id: overtimeRequests.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, overtimeDate: overtimeRequests.overtimeDate, startTime: overtimeRequests.startTime, endTime: overtimeRequests.endTime, durationMinutes: overtimeRequests.durationMinutes, description: overtimeRequests.description, status: overtimeRequests.status, createdAt: overtimeRequests.createdAt }).from(overtimeRequests).innerJoin(employees, eq(overtimeRequests.employeeId, employees.id)).where(and(eq(overtimeRequests.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.userId))).orderBy(desc(overtimeRequests.createdAt));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/lembur", "write"); if ("error" in context) return context.error;
  const parsed = overtimeInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Karyawan, tanggal, durasi, dan deskripsi lembur wajib diisi." }, { status: 400 });
  const employee = await selectableEmployee(context, parsed.data.employeeId); if (!employee) return Response.json({ error: "Karyawan tidak ditemukan atau tidak dapat dipilih." }, { status: 403 });
  const [schedule] = await db.select({ endTime: workSchedules.endTime }).from(divisions).innerJoin(workSchedules, eq(divisions.scheduleId, workSchedules.id)).where(and(eq(divisions.companyId, context.companyId), eq(divisions.name, employee.department), eq(divisions.active, true), eq(workSchedules.active, true))).limit(1);
  const startTime = schedule?.endTime ?? "17:00:00"; const endTime = addMinutes(startTime, parsed.data.durationMinutes);
  const [created] = await db.insert(overtimeRequests).values({ companyId: context.companyId, ...parsed.data, startTime, endTime }).returning();
  revalidateRequestPaths(revalidatePath, path); return Response.json({ row: { ...created, name: employee.name, employeeCode: employee.employeeCode, department: employee.department } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/lembur", "manage"); if ("error" in context) return context.error;
  const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(200), status: z.enum(["approved", "rejected"]) }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Pilih pengajuan dan keputusan yang valid." }, { status: 400 });
  const rows = await db.update(overtimeRequests).set({ status: parsed.data.status, reviewedBy: context.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(overtimeRequests.companyId, context.companyId), eq(overtimeRequests.status, "pending"), inArray(overtimeRequests.id, parsed.data.ids))).returning({ id: overtimeRequests.id, status: overtimeRequests.status });
  revalidateRequestPaths(revalidatePath, path); return Response.json({ rows });
}

export function addMinutes(time: string, duration: number) { const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + duration; return `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`; }
