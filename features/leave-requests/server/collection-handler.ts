import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, fileAssets, leaveRequests } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { ATTACHMENT_INVALID, claimRequestAttachment } from "@/features/employee-requests/server/request-attachment";
import { leaveInputSchema, resolveLeavePaid, reviewerRoles } from "./schemas";
import { resolveLeaveRules } from "./resolve-leave";

export async function GET(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "read");
  if ("error" in context) return context.error;
  const canReview = reviewerRoles.includes(context.role);
  const rows = await db.select({ id: leaveRequests.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, type: leaveRequests.type, specialLeaveTypeId: leaveRequests.specialLeaveTypeId, specialLeaveName: leaveRequests.specialLeaveName, workDays: leaveRequests.workDays, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, reason: leaveRequests.reason, status: leaveRequests.status, paid: leaveRequests.paid, createdAt: leaveRequests.createdAt, attachmentAssetId: leaveRequests.attachmentAssetId, attachmentName: fileAssets.originalName })
    .from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id)).leftJoin(fileAssets, eq(fileAssets.id, leaveRequests.attachmentAssetId))
    .where(and(eq(leaveRequests.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.userId))).orderBy(desc(leaveRequests.createdAt));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "write");
  if ("error" in context) return context.error;
  const parsed = leaveInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Data pengajuan tidak valid." }, { status: 400 });
  const { attachmentAssetId, ...input } = parsed.data;
  if (!attachmentAssetId) return Response.json({ error: "Lampiran wajib diunggah (PDF atau foto, maks. 8 MB)." }, { status: 400 });
  const canReview = reviewerRoles.includes(context.role);
  const [employee] = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, userId: employees.userId }).from(employees)
    .where(and(eq(employees.id, parsed.data.employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active"))).limit(1);
  if (!employee || (!canReview && employee.userId !== context.userId)) return Response.json({ error: "Karyawan tidak ditemukan atau tidak dapat dipilih." }, { status: 403 });
  const special = await resolveLeaveRules(context.companyId, input);
  if (!special.ok) return Response.json({ error: special.error }, { status: 400 });
  const attachment = await claimRequestAttachment(context, attachmentAssetId, employee.id);
  if (!attachment) return Response.json({ error: ATTACHMENT_INVALID }, { status: 400 });
  const [created] = await db.insert(leaveRequests).values({ companyId: context.companyId, ...input, ...special.values, paid: resolveLeavePaid(input, canReview, special.paid), attachmentAssetId: attachment.id }).returning();
  revalidatePaths();
  return Response.json({ row: { ...created, name: employee.name, employeeCode: employee.employeeCode, department: employee.department, attachmentName: attachment.name } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "manage");
  if ("error" in context) return context.error;
  const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(200), status: z.enum(["approved", "rejected"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pilih pengajuan dan keputusan yang valid." }, { status: 400 });
  const rows = await db.update(leaveRequests).set({ status: parsed.data.status, reviewedBy: context.userId, reviewedAt: new Date() })
    .where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "pending"), inArray(leaveRequests.id, parsed.data.ids))).returning({ id: leaveRequests.id, status: leaveRequests.status });
  revalidatePaths();
  return Response.json({ rows });
}

function revalidatePaths() {
  revalidatePath("/dashboard/pengajuan");
  revalidatePath("/dashboard/pengajuan/izin-cuti");
  revalidatePath("/dashboard");
}
