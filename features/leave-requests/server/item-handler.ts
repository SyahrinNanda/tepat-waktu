import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { leaveInputSchema, resolveLeavePaid, reviewerRoles } from "./schemas";

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
  const [existing] = await db.select({ id: leaveRequests.id, status: leaveRequests.status, employeeUserId: employees.userId }).from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id)).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).limit(1);
  if (!existing || (!canReview && existing.employeeUserId !== context.userId)) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (existing.status !== "pending") return Response.json({ error: "Hanya pengajuan berstatus menunggu yang dapat diedit." }, { status: 409 });
  const [employee] = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, userId: employees.userId }).from(employees).where(and(eq(employees.id, parsed.data.employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active"))).limit(1);
  if (!employee || (!canReview && employee.userId !== context.userId)) return Response.json({ error: "Karyawan tidak ditemukan atau tidak dapat dipilih." }, { status: 403 });
  const [updated] = await db.update(leaveRequests).set({ ...parsed.data, paid: resolveLeavePaid(parsed.data, canReview) }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).returning();
  revalidatePaths(id);
  return Response.json({ row: { ...updated, name: employee.name, employeeCode: employee.employeeCode, department: employee.department } });
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "manage");
  if ("error" in context) return context.error;
  const id = (await params).id;
  const [row] = await db.delete(leaveRequests).where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId))).returning({ id: leaveRequests.id });
  if (!row) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  revalidatePaths(id);
  return Response.json({ ok: true });
}

function revalidatePaths(id: string) {
  revalidatePath("/dashboard/pengajuan"); revalidatePath("/dashboard/pengajuan/izin-cuti"); revalidatePath(`/dashboard/pengajuan/izin-cuti/${id}`); revalidatePath("/dashboard");
}
