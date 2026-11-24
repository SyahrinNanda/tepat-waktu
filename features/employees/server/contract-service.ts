import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeContracts, employees } from "@/db/schema";
import { CONTRACT_TYPES } from "@/features/employees/contracts";

/** Contract rules shared by the web server actions and the mobile API (callers check the role first). */
export type ContractResult = { ok: true } | { ok: false; error: string };

export const contractSchema = z.object({
  contractType: z.enum(CONTRACT_TYPES, "Pilih tipe kontrak."),
  startDate: z.iso.date("Isi tanggal mulai kontrak."),
  durationMonths: z.coerce.number().int("Durasi harus bilangan bulat.").min(1, "Durasi minimal 1 bulan.").max(240, "Durasi maksimal 240 bulan.").nullable(),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").nullable(),
  active: z.boolean(),
});
export type ContractInput = z.input<typeof contractSchema>;

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

export async function listContracts(companyId: string, employeeId: string) {
  return db.select({ id: employeeContracts.id, contractType: employeeContracts.contractType, startDate: employeeContracts.startDate, durationMonths: employeeContracts.durationMonths, note: employeeContracts.note, active: employeeContracts.active })
    .from(employeeContracts).where(and(eq(employeeContracts.companyId, companyId), eq(employeeContracts.employeeId, employeeId)))
    .orderBy(desc(employeeContracts.active), desc(employeeContracts.startDate), desc(employeeContracts.createdAt));
}

export async function saveContractFor(companyId: string, employeeId: string, contractId: string | null, input: ContractInput): Promise<ContractResult> {
  const parsed = contractSchema.safeParse({ ...input, note: input.note || null, durationMonths: input.durationMonths === "" ? null : input.durationMonths });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!await ownedEmployee(companyId, employeeId)) return fail("Karyawan tidak ditemukan.");
  const values = parsed.data;
  if (values.contractType !== "Tetap" && !values.durationMonths) return fail("Isi durasi kontrak (dalam bulan).");
  const saved = await db.transaction(async (tx) => {
    const [row] = contractId
      ? await tx.update(employeeContracts).set({ ...values, updatedAt: new Date() })
        .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, companyId), eq(employeeContracts.employeeId, employeeId))).returning({ id: employeeContracts.id })
      : await tx.insert(employeeContracts).values({ ...values, companyId, employeeId }).returning({ id: employeeContracts.id });
    if (row && values.active) await syncActive(tx, companyId, employeeId, row.id, values.contractType);
    return row;
  });
  return saved ? { ok: true } : fail("Kontrak tidak ditemukan.");
}

/** Perpanjang: adds months to the contract's duration (the end date moves forward). */
export async function extendContractFor(companyId: string, employeeId: string, contractId: string, addMonths: number): Promise<ContractResult> {
  const months = z.number().int().min(1).max(120).safeParse(addMonths);
  if (!months.success) return fail("Perpanjangan antara 1 sampai 120 bulan.");
  const [contract] = await db.select({ durationMonths: employeeContracts.durationMonths }).from(employeeContracts)
    .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, companyId), eq(employeeContracts.employeeId, employeeId))).limit(1);
  if (!contract) return fail("Kontrak tidak ditemukan.");
  if (!contract.durationMonths) return fail("Kontrak tanpa batas waktu tidak perlu diperpanjang.");
  if (contract.durationMonths + months.data > 240) return fail("Total durasi kontrak maksimal 240 bulan.");
  await db.update(employeeContracts).set({ durationMonths: contract.durationMonths + months.data, updatedAt: new Date() }).where(eq(employeeContracts.id, contractId));
  return { ok: true };
}

export async function deleteContractFor(companyId: string, employeeId: string, contractId: string): Promise<ContractResult> {
  const [row] = await db.delete(employeeContracts)
    .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.companyId, companyId), eq(employeeContracts.employeeId, employeeId))).returning({ id: employeeContracts.id });
  return row ? { ok: true } : fail("Kontrak tidak ditemukan.");
}
