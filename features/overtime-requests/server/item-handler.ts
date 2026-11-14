import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { divisions, employees, fileAssets, overtimeRequests, workSchedules } from "@/db/schema";
import { canReviewRequests, employeeRequestContext, revalidateRequestPaths, selectableEmployee } from "@/features/employee-requests/server/request-context";
import { addMinutes, overtimeInput } from "./collection-handler";
import { ATTACHMENT_INVALID, claimRequestAttachment, removeRequestAttachment } from "@/features/employee-requests/server/request-attachment";
type Params = { params: Promise<{ id: string }> }; const path = "/dashboard/pengajuan/lembur";

export async function PATCH(request: Request, { params }: Params) {
  const context = await employeeRequestContext(request, "pengajuan/lembur", "write"); if ("error" in context) return context.error; const id = (await params).id; const parsed = overtimeInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data lembur tidak valid." }, { status: 400 });
  const [existing] = await db.select({ status: overtimeRequests.status, userId: employees.userId, attachmentAssetId: overtimeRequests.attachmentAssetId }).from(overtimeRequests).innerJoin(employees, eq(overtimeRequests.employeeId, employees.id)).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).limit(1);
  if (!existing || (!canReviewRequests(context.role) && existing.userId !== context.userId)) return Response.json({ error: "Pengajuan lembur tidak ditemukan." }, { status: 404 }); if (existing.status !== "pending") return Response.json({ error: "Hanya pengajuan menunggu yang dapat diedit." }, { status: 409 });
  const employee = await selectableEmployee(context, parsed.data.employeeId); if (!employee) return Response.json({ error: "Karyawan tidak dapat dipilih." }, { status: 403 });
  const [schedule] = await db.select({ endTime: workSchedules.endTime }).from(divisions).innerJoin(workSchedules, eq(divisions.scheduleId, workSchedules.id)).where(and(eq(divisions.companyId, context.companyId), eq(divisions.name, employee.department), eq(divisions.active, true), eq(workSchedules.active, true))).limit(1); const startTime = schedule?.endTime ?? "17:00:00";
  // A new file replaces the current one; without one the current file (if any) stays.
  const { attachmentAssetId, ...input } = parsed.data;
  const replacing = Boolean(attachmentAssetId && attachmentAssetId !== existing.attachmentAssetId);
  const attachment = replacing && attachmentAssetId ? await claimRequestAttachment(context, attachmentAssetId, employee.id) : null;
  if (replacing && !attachment) return Response.json({ error: ATTACHMENT_INVALID }, { status: 400 });
  const nextAttachmentId = attachment?.id ?? existing.attachmentAssetId;
  const [updated] = await db.update(overtimeRequests).set({ ...input, startTime, endTime: addMinutes(startTime, input.durationMinutes), attachmentAssetId: nextAttachmentId, updatedAt: new Date() }).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).returning();
  if (replacing) await removeRequestAttachment(existing.attachmentAssetId);
  const [file] = nextAttachmentId ? await db.select({ name: fileAssets.originalName }).from(fileAssets).where(eq(fileAssets.id, nextAttachmentId)).limit(1) : [];
  revalidateRequestPaths(revalidatePath, path, id); return Response.json({ row: { ...updated, name: employee.name, employeeCode: employee.employeeCode, department: employee.department, attachmentName: file?.name ?? null } });
}

export async function DELETE(request: Request, { params }: Params) { const context = await employeeRequestContext(request, "pengajuan/lembur", "manage"); if ("error" in context) return context.error; const id = (await params).id; const [row] = await db.delete(overtimeRequests).where(and(eq(overtimeRequests.id, id), eq(overtimeRequests.companyId, context.companyId))).returning({ id: overtimeRequests.id, attachmentAssetId: overtimeRequests.attachmentAssetId }); if (!row) return Response.json({ error: "Pengajuan lembur tidak ditemukan." }, { status: 404 }); await removeRequestAttachment(row.attachmentAssetId); revalidateRequestPaths(revalidatePath, path, id); return Response.json({ ok: true }); }
