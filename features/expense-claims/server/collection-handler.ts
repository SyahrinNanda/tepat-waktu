import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, expenseClaims, fileAssets } from "@/db/schema";
import { canReviewRequests, employeeRequestContext, selectableEmployee } from "@/features/employee-requests/server/request-context";
import { expenseClaimInput } from "./schemas";

const path = "/dashboard/pengajuan/klaim-beban";
const columns = { id: expenseClaims.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, requestDate: expenseClaims.requestDate, amount: expenseClaims.amount, description: expenseClaims.description, note: expenseClaims.note, proofAssetId: expenseClaims.proofAssetId, status: expenseClaims.status, createdAt: expenseClaims.createdAt };

async function validProof(companyId: string, proofAssetId?: string | null) {
  if (!proofAssetId) return true;
  const [asset] = await db.select({ id: fileAssets.id }).from(fileAssets).where(and(eq(fileAssets.id, proofAssetId), eq(fileAssets.companyId, companyId), eq(fileAssets.category, "claim_attachment"))).limit(1);
  return Boolean(asset);
}

export async function GET(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/klaim-beban", "read"); if ("error" in context) return context.error;
  const canReview = canReviewRequests(context.role);
  const rows = await db.select(columns).from(expenseClaims).innerJoin(employees, eq(expenseClaims.employeeId, employees.id)).where(and(eq(expenseClaims.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.userId))).orderBy(desc(expenseClaims.createdAt));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/klaim-beban", "write"); if ("error" in context) return context.error;
  const parsed = expenseClaimInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Karyawan, tanggal, nominal, dan deskripsi wajib diisi." }, { status: 400 });
  const employee = await selectableEmployee(context, parsed.data.employeeId);
  if (!employee) return Response.json({ error: "Karyawan tidak ditemukan atau tidak dapat dipilih." }, { status: 403 });
  if (!await validProof(context.companyId, parsed.data.proofAssetId)) return Response.json({ error: "Bukti klaim tidak valid." }, { status: 400 });
  const [created] = await db.insert(expenseClaims).values({ companyId: context.companyId, ...parsed.data, note: parsed.data.note || null }).returning();
  revalidatePath(path); return Response.json({ row: { ...created, name: employee.name, employeeCode: employee.employeeCode, department: employee.department } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await employeeRequestContext(request, "pengajuan/klaim-beban", "manage"); if ("error" in context) return context.error;
  const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(200), status: z.enum(["approved", "rejected"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pilih klaim dan keputusan yang valid." }, { status: 400 });
  const rows = await db.update(expenseClaims).set({ status: parsed.data.status, reviewedBy: context.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(expenseClaims.companyId, context.companyId), eq(expenseClaims.status, "pending"), inArray(expenseClaims.id, parsed.data.ids))).returning({ id: expenseClaims.id, status: expenseClaims.status });
  revalidatePath(path); return Response.json({ rows });
}

export { validProof };
