import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employees, expenseClaims, fileAssets } from "@/db/schema";
import { canReviewRequests, employeeRequestContext, selectableEmployee } from "@/features/employee-requests/server/request-context";
import { deletePrivateObject } from "@/lib/object-storage";
import { validProof } from "./collection-handler";
import { expenseClaimInput } from "./schemas";

type Params = { params: Promise<{ id: string }> };
const path = "/dashboard/pengajuan/klaim-beban";

export async function PATCH(request: Request, { params }: Params) {
  const context = await employeeRequestContext(request, "pengajuan/klaim-beban", "write"); if ("error" in context) return context.error;
  const id = (await params).id; const parsed = expenseClaimInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data klaim beban tidak valid." }, { status: 400 });
  const [existing] = await db.select({ status: expenseClaims.status, userId: employees.userId }).from(expenseClaims).innerJoin(employees, eq(expenseClaims.employeeId, employees.id)).where(and(eq(expenseClaims.id, id), eq(expenseClaims.companyId, context.companyId))).limit(1);
  if (!existing || (!canReviewRequests(context.role) && existing.userId !== context.userId)) return Response.json({ error: "Klaim tidak ditemukan." }, { status: 404 });
  if (existing.status !== "pending") return Response.json({ error: "Hanya klaim menunggu yang dapat diedit." }, { status: 409 });
  const employee = await selectableEmployee(context, parsed.data.employeeId); if (!employee) return Response.json({ error: "Karyawan tidak dapat dipilih." }, { status: 403 });
  if (!await validProof(context.companyId, parsed.data.proofAssetId)) return Response.json({ error: "Bukti klaim tidak valid." }, { status: 400 });
  const [updated] = await db.update(expenseClaims).set({ ...parsed.data, note: parsed.data.note || null, updatedAt: new Date() }).where(and(eq(expenseClaims.id, id), eq(expenseClaims.companyId, context.companyId))).returning();
  revalidatePath(path); return Response.json({ row: { ...updated, name: employee.name, employeeCode: employee.employeeCode, department: employee.department } });
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await employeeRequestContext(request, "pengajuan/klaim-beban", "manage"); if ("error" in context) return context.error;
  const id = (await params).id;
  const [claim] = await db.select({ proofAssetId: expenseClaims.proofAssetId, bucket: fileAssets.bucket, objectKey: fileAssets.objectKey }).from(expenseClaims).leftJoin(fileAssets, eq(expenseClaims.proofAssetId, fileAssets.id)).where(and(eq(expenseClaims.id, id), eq(expenseClaims.companyId, context.companyId))).limit(1);
  if (!claim) return Response.json({ error: "Klaim tidak ditemukan." }, { status: 404 });
  await db.transaction(async (tx) => { await tx.delete(expenseClaims).where(and(eq(expenseClaims.id, id), eq(expenseClaims.companyId, context.companyId))); if (claim.proofAssetId) await tx.delete(fileAssets).where(eq(fileAssets.id, claim.proofAssetId)); });
  if (claim.bucket && claim.objectKey) await deletePrivateObject(claim.bucket, claim.objectKey).catch(() => undefined);
  revalidatePath(path); return Response.json({ ok: true });
}
