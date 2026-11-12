"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employeeContracts, employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { CONTRACT_TYPES } from "@/features/employees/contracts";

export type ContractResult = { ok: true } | { ok: false; error: string };

const contractSchema = z.object({
  contractType: z.enum(CONTRACT_TYPES, "Pilih tipe kontrak."),
  startDate: z.iso.date("Isi tanggal mulai kontrak."),
  durationMonths: z.coerce.number().int("Durasi harus bilangan bulat.").min(1, "Durasi minimal 1 bulan.").max(240, "Durasi maksimal 240 bulan.").nullable(),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").nullable(),
  active: z.boolean(),
});
export type ContractInput = z.input<typeof contractSchema>;

const managers = ["admin", "general_manager", "hrd"] as const;
const fail = (error: string): ContractResult => ({ ok: false, error });
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Data kontrak tidak valid.";

async function ownedEmployee(companyId: string, employeeId: string) {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  return row;
}

/** Keeps one active contract per employee and mirrors its type to the employee record (shown in the employee list). */
async function syncActive(tx: Pick<typeof db, "update">, companyId: string, employeeId: string, contractId: string, contractType: string) {
  await tx.update(employeeContracts).set({ active: false, updatedAt: new Date() })
    .where(and(eq(employeeContracts.companyId, companyId), eq(employeeContracts.employeeId, employeeId), ne(employeeContracts.id, contractId), eq(employeeContracts.active, true)));
  await tx.update(employees).set({ contractType }).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)));
}

const refresh = (employeeId: string) => { revalidatePath(`/dashboard/karyawan/${employeeId}`); revalidatePath("/dashboard/karyawan"); };

export async function saveContract(employeeId: string, contractId: string | null, input: ContractInput): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const parsed = contractSchema.safeParse({ ...input, note: input.note || null, durationMonths: input.durationMonths === "" ? null : input.durationMonths });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!await ownedEmployee(context.companyId, employeeId)) return fail("Karyawan tidak ditemukan.");
  const values = parsed.data;
  if (values.contractType !== "Tetap" && !values.durationMonths) return fail("Isi durasi kontrak (dalam bulan).");

  const saved = await db.transaction(async (tx) => {
    const [row] = contractId
      ? await tx.update(employeeContracts).set({ ...values, updatedAt: new Date() })
        .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, context.companyId), eq(employeeContracts.employeeId, employeeId))).returning({ id: employeeContracts.id })
      : await tx.insert(employeeContracts).values({ ...values, companyId: context.companyId, employeeId }).returning({ id: employeeContracts.id });
    if (row && values.active) await syncActive(tx, context.companyId, employeeId, row.id, values.contractType);
    return row;
  });
  if (!saved) return fail("Kontrak tidak ditemukan.");
  refresh(employeeId);
  return { ok: true };
}

/** Perpanjang: adds months to the contract's duration (the end date moves forward). */
export async function extendContract(employeeId: string, contractId: string, addMonths: number): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const months = z.number().int().min(1).max(120).safeParse(addMonths);
  if (!months.success) return fail("Perpanjangan antara 1 sampai 120 bulan.");
  const [contract] = await db.select({ durationMonths: employeeContracts.durationMonths }).from(employeeContracts)
    .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, context.companyId), eq(employeeContracts.employeeId, employeeId))).limit(1);
  if (!contract) return fail("Kontrak tidak ditemukan.");
  if (!contract.durationMonths) return fail("Kontrak tanpa batas waktu tidak perlu diperpanjang.");
  if (contract.durationMonths + months.data > 240) return fail("Total durasi kontrak maksimal 240 bulan.");
  await db.update(employeeContracts).set({ durationMonths: contract.durationMonths + months.data, updatedAt: new Date() }).where(eq(employeeContracts.id, contractId));
  refresh(employeeId);
  return { ok: true };
}

export async function deleteContract(employeeId: string, contractId: string): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const [row] = await db.delete(employeeContracts)
    .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, context.companyId), eq(employeeContracts.employeeId, employeeId))).returning({ id: employeeContracts.id });
  if (!row) return fail("Kontrak tidak ditemukan.");
  refresh(employeeId);
  return { ok: true };
}
