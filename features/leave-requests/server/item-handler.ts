import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, fileAssets, leaveRequests } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { ATTACHMENT_INVALID, claimRequestAttachment, removeRequestAttachment } from "@/features/employee-requests/server/request-attachment";
import { leaveInputSchema, resolveLeavePaid, reviewerRoles } from "./schemas";
import { resolveLeaveRules } from "./resolve-leave";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "write");
  if ("error" in context) return context.error;
  const id = (await params).id;
  const body = await request.json().catch(() => null);
  const canReview = reviewerRoles.includes(context.role);
  if (body?.action === "pay") {
    if (!canReview) return Response.json({ error: "Tidak memiliki akses untuk mengubah status gaji izin." }, { status: 403 });
    const parsed = z.object({ action: z.literal("pay"), paid: z.boolean() }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "Status gaji tidak valid." }, { status: 400 });
    const [row] = await db.update(leaveRequests).set({ paid: parsed.data.paid }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).returning();
    if (!row) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    revalidatePaths(id); return Response.json({ row });
  }
  if (body?.action === "review") {
    if (!canReview) return Response.json({ error: "Tidak memiliki akses untuk memproses pengajuan." }, { status: 403 });
    const parsed = z.object({ action: z.literal("review"), status: z.enum(["approved", "rejected"]) }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "Keputusan tidak valid." }, { status: 400 });
    const [row] = await db.update(leaveRequests).set({ status: parsed.data.status, reviewedBy: context.userId, reviewedAt: new Date() }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "pending"))).returning();
    if (!row) return Response.json({ error: "Pengajuan tidak ditemukan atau sudah diproses." }, { status: 404 });
    revalidatePaths(id); return Response.json({ row });
  }
  const parsed = leaveInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Data pengajuan tidak valid." }, { status: 400 });
  const { attachmentAssetId, ...input } = parsed.data;
  const [existing] = await db.select({ id: leaveRequests.id, status: leaveRequests.status, employeeUserId: employees.userId, attachmentAssetId: leaveRequests.attachmentAssetId }).from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id)).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).limit(1);
  if (!existing || (!canReview && existing.employeeUserId !== context.userId)) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (existing.status !== "pending") return Response.json({ error: "Hanya pengajuan berstatus menunggu yang dapat diedit." }, { status: 409 });
  const [employee] = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, userId: employees.userId }).from(employees).where(and(eq(employees.id, parsed.data.employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active"))).limit(1);
  if (!employee || (!canReview && employee.userId !== context.userId)) return Response.json({ error: "Karyawan tidak ditemukan atau tidak dapat dipilih." }, { status: 403 });
  const special = await resolveLeaveRules(context.companyId, input, id);
  if (!special.ok) return Response.json({ error: special.error }, { status: 400 });
  // A new file replaces the current one; without one the current file stays (it is still required).
  const replacing = Boolean(attachmentAssetId && attachmentAssetId !== existing.attachmentAssetId);
  const attachment = replacing && attachmentAssetId ? await claimRequestAttachment(context, attachmentAssetId, employee.id) : null;
  if (replacing && !attachment) return Response.json({ error: ATTACHMENT_INVALID }, { status: 400 });
  const nextAttachmentId = attachment?.id ?? existing.attachmentAssetId;
  if (!nextAttachmentId) return Response.json({ error: "Lampiran wajib diunggah (PDF atau foto, maks. 8 MB)." }, { status: 400 });
  const [updated] = await db.update(leaveRequests).set({ ...input, ...special.values, paid: resolveLeavePaid(input, canReview, special.paid), attachmentAssetId: nextAttachmentId }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).returning();
  if (replacing) await removeRequestAttachment(existing.attachmentAssetId);
  const [file] = await db.select({ name: fileAssets.originalName }).from(fileAssets).where(eq(fileAssets.id, nextAttachmentId)).limit(1);
  revalidatePaths(id);
  return Response.json({ row: { ...updated, name: employee.name, employeeCode: employee.employeeCode, department: employee.department, attachmentName: file?.name ?? null } });
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "manage");
  if ("error" in context) return context.error;
  const id = (await params).id;
  const [row] = await db.delete(leaveRequests).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).returning({ id: leaveRequests.id, attachmentAssetId: leaveRequests.attachmentAssetId });
  if (!row) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  await removeRequestAttachment(row.attachmentAssetId);
  revalidatePaths(id);
  return Response.json({ ok: true });
}

function revalidatePaths(id: string) {
  revalidatePath("/dashboard/pengajuan"); revalidatePath("/dashboard/pengajuan/izin-cuti"); revalidatePath(`/dashboard/pengajuan/izin-cuti/${id}`); revalidatePath("/dashboard");
}
