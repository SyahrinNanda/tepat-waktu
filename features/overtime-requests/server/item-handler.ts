import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { divisions, employees, overtimeRequests, workSchedules } from "@/db/schema";
import { canReviewRequests, employeeRequestContext, revalidateRequestPaths, selectableEmployee } from "@/features/employee-requests/server/request-context";
import { addMinutes, overtimeInput } from "./collection-handler";
type Params = { params: Promise<{ id: string }> }; const path = "/dashboard/pengajuan/lembur";

export async function PATCH(request: Request, { params }: Params) {
  const context = await employeeRequestContext(request, "pengajuan/lembur", "write"); if ("error" in context) return context.error; const id = (await params).id; const parsed = overtimeInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data lembur tidak valid." }, { status: 400 });
  const [existing] = await db.select({ status: overtimeRequests.status, userId: employees.userId }).from(overtimeRequests).innerJoin(employees, eq(overtimeRequests.employeeId, employees.id)).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).limit(1);
  if (!existing || (!canReviewRequests(context.role) && existing.userId !== context.userId)) return Response.json({ error: "Pengajuan lembur tidak ditemukan." }, { status: 404 }); if (existing.status !== "pending") return Response.json({ error: "Hanya pengajuan menunggu yang dapat diedit." }, { status: 409 });
  const employee = await selectableEmployee(context, parsed.data.employeeId); if (!employee) return Response.json({ error: "Karyawan tidak dapat dipilih." }, { status: 403 });
  const [schedule] = await db.select({ endTime: workSchedules.endTime }).from(divisions).innerJoin(workSchedules, eq(divisions.scheduleId, workSchedules.id)).where(and(eq(divisions.companyId, context.companyId), eq(divisions.name, employee.department), eq(divisions.active, true), eq(workSchedules.active, true))).limit(1); const startTime = schedule?.endTime ?? "17:00:00";
  const [updated] = await db.update(overtimeRequests).set({ ...parsed.data, startTime, endTime: addMinutes(startTime, parsed.data.durationMinutes), updatedAt: new Date() }).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).returning(); revalidateRequestPaths(revalidatePath, path, id); return Response.json({ row: { ...updated, name: employee.name, employeeCode: employee.employeeCode, department: employee.department } });
}

export async function DELETE(request: Request, { params }: Params) { const context = await employeeRequestContext(request, "pengajuan/lembur", "manage"); if ("error" in context) return context.error; const id = (await params).id; const [row] = await db.delete(overtimeRequests).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).returning({ id: overtimeRequests.id }); if (!row) return Response.json({ error: "Pengajuan lembur tidak ditemukan." }, { status: 404 }); revalidateRequestPaths(revalidatePath, path, id); return Response.json({ ok: true }); }
