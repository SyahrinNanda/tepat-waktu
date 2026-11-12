import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, leaveRequests, specialLeaveTypes } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { schedulePlanner } from "@/features/payslips/server/payslip-service";
import { planSpecialLeave, reviewerRoles, specialLeaveTypeSchema } from "./schemas";

export type SpecialLeaveTypeRow = { id: string; name: string; durationDays: number | null; paid: boolean };

const columns = {
  id: specialLeaveTypes.id, name: specialLeaveTypes.name, durationDays: specialLeaveTypes.durationDays,
  paid: specialLeaveTypes.paid,
};

export function listSpecialLeaveTypes(companyId: string): Promise<SpecialLeaveTypeRow[]> {
  return db.select(columns).from(specialLeaveTypes).where(eq(specialLeaveTypes.companyId, companyId)).orderBy(asc(specialLeaveTypes.name));
}

type SpecialInput = { employeeId: string; type: string; specialLeaveTypeId?: string | null; startDate: string; endDate: string };
type Resolved =
  | { ok: true; values: { specialLeaveTypeId: string | null; specialLeaveName: string | null; workDays: number | null; startDate: string; endDate: string }; paid?: boolean }
  | { ok: false; error: string };

/**
 * Applies the rules of a Cuti Khusus kind to a request: who may take it, the dates in the employee's
 * working days (fixed duration -> computed end date). Other leave types pass through with the
 * special columns cleared.
 */
export async function resolveSpecialLeave(companyId: string, input: SpecialInput): Promise<Resolved> {
  if (input.type !== "special") return { ok: true, values: { specialLeaveTypeId: null, specialLeaveName: null, workDays: null, startDate: input.startDate, endDate: input.endDate } };
  const [[kind], [employee]] = await Promise.all([
    input.specialLeaveTypeId
      ? db.select(columns).from(specialLeaveTypes).where(and(eq(specialLeaveTypes.id, input.specialLeaveTypeId), eq(specialLeaveTypes.companyId, companyId))).limit(1)
      : Promise.resolve([]),
    db.select({ department: employees.department }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId))).limit(1),
  ]);
  if (!kind) return { ok: false, error: "Jenis cuti khusus tidak ditemukan. Pilih ulang jenisnya." };
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };

  const planFor = await schedulePlanner(companyId, employee.department, []);
  const plan = planSpecialLeave({ start: input.startDate, end: input.endDate, durationDays: kind.durationDays, isWorkDay: (date) => planFor(date, null) !== null });
  if (!plan.ok) return plan;

  return { ok: true, values: { specialLeaveTypeId: kind.id, specialLeaveName: kind.name, workDays: plan.workDays, startDate: plan.startDate, endDate: plan.endDate }, paid: kind.paid };
}

const duplicate = (error: unknown) => (error as { code?: string; cause?: { code?: string } })?.code === "23505" || (error as { cause?: { code?: string } })?.cause?.code === "23505";

async function managerContext(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "manage");
  if ("error" in context) return context;
  if (!reviewerRoles.includes(context.role)) return { error: Response.json({ error: "Hanya Admin, GM, atau HRD yang dapat mengelola jenis cuti khusus." }, { status: 403 }) } as const;
  return context;
}

function revalidate() { revalidatePath("/dashboard/pengajuan/izin-cuti"); revalidatePath("/dashboard/karyawan/laporan-cuti"); }

const toValues = (data: z.infer<typeof specialLeaveTypeSchema>) => ({
  name: data.name, durationDays: data.durationDays ?? null, paid: data.paid,
});

/** GET /api/leave-requests/special-types: every member of the company may read the list. */
export async function GET(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "read");
  if ("error" in context) return context.error;
  return Response.json({ rows: await listSpecialLeaveTypes(context.companyId) });
}

export async function POST(request: Request) {
  const context = await managerContext(request);
  if ("error" in context) return context.error;
  const parsed = specialLeaveTypeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Data jenis cuti tidak valid." }, { status: 400 });
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(specialLeaveTypes).where(eq(specialLeaveTypes.companyId, context.companyId));
  if ((count?.n ?? 0) >= 50) return Response.json({ error: "Maksimal 50 jenis cuti khusus per perusahaan." }, { status: 400 });
  try {
    const [row] = await db.insert(specialLeaveTypes).values({ companyId: context.companyId, ...toValues(parsed.data) }).returning(columns);
    revalidate();
    return Response.json({ row }, { status: 201 });
  } catch (error) {
    if (duplicate(error)) return Response.json({ error: `Jenis cuti "${parsed.data.name}" sudah ada.` }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ typeId: string }> }) {
  const context = await managerContext(request);
  if ("error" in context) return context.error;
  const { typeId } = await params;
  const parsed = specialLeaveTypeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Data jenis cuti tidak valid." }, { status: 400 });
  try {
    const row = await db.transaction(async (tx) => {
      const [updated] = await tx.update(specialLeaveTypes).set({ ...toValues(parsed.data), updatedAt: new Date() })
        .where(and(eq(specialLeaveTypes.id, typeId), eq(specialLeaveTypes.companyId, context.companyId))).returning(columns);
      // Requests still waiting for a decision show the new name; decided ones keep the name they were approved under.
      if (updated) await tx.update(leaveRequests).set({ specialLeaveName: updated.name })
        .where(and(eq(leaveRequests.specialLeaveTypeId, updated.id), eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "pending")));
      return updated;
    });
    if (!row) return Response.json({ error: "Jenis cuti tidak ditemukan." }, { status: 404 });
    revalidate();
    return Response.json({ row });
  } catch (error) {
    if (duplicate(error)) return Response.json({ error: `Jenis cuti "${parsed.data.name}" sudah ada.` }, { status: 409 });
    throw error;
  }
}

/** Removing a kind keeps past requests (they keep its name); it just can no longer be chosen. */
export async function DELETE(request: Request, { params }: { params: Promise<{ typeId: string }> }) {
  const context = await managerContext(request);
  if ("error" in context) return context.error;
  const { typeId } = await params;
  const [row] = await db.delete(specialLeaveTypes).where(and(eq(specialLeaveTypes.id, typeId), eq(specialLeaveTypes.companyId, context.companyId))).returning({ id: specialLeaveTypes.id });
  if (!row) return Response.json({ error: "Jenis cuti tidak ditemukan." }, { status: 404 });
  revalidate();
  return Response.json({ ok: true });
}

const previewSchema = z.object({ employeeId: z.uuid(), specialLeaveTypeId: z.uuid(), startDate: z.iso.date(), endDate: z.iso.date().optional() });

/**
 * POST /api/leave-requests/special-types/preview: the dates the form will get, using the
 * same rules as saving (so the employee sees the computed end date before submitting).
 */
export async function previewSpecialLeave(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "read");
  if ("error" in context) return context.error;
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 400 });
  const input = parsed.data;
  if (!reviewerRoles.includes(context.role)) {
    const [own] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, context.companyId), eq(employees.userId, context.userId))).limit(1);
    if (!own) return Response.json({ error: "Karyawan tidak dapat dipilih." }, { status: 403 });
  }
  const result = await resolveSpecialLeave(context.companyId, { ...input, type: "special", endDate: input.endDate ?? input.startDate });
  if (!result.ok) return Response.json({ ok: false, error: result.error });
  return Response.json({ ok: true, startDate: result.values.startDate, endDate: result.values.endDate, workDays: result.values.workDays, paid: result.paid });
}
