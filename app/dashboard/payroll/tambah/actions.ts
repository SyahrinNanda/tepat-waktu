"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employees, featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { rupiah } from "@/lib/subscription-format";

export async function createPayroll(form: FormData) {
  const context = await requireCompanyRole(["admin", "hrd", "general_manager"]);
  const data = z.object({ employeeId: z.uuid(), month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2020).max(2100), type: z.enum(["Pendapatan", "Potongan"]), quantity: z.coerce.number().positive().max(1000000), nominal: z.coerce.number().int().min(0).max(100000000000) }).parse(Object.fromEntries(form));
  const [employee] = await db.select({ id: employees.id, name: employees.name }).from(employees).where(and(eq(employees.id, data.employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active"))).limit(1);
  if (!employee) throw new Error("Karyawan aktif tidak ditemukan.");
  const total = Math.round(data.quantity * data.nominal);
  if (!Number.isSafeInteger(total)) throw new Error("Nominal di luar batas.");
  const pendapatan = data.type === "Pendapatan" ? total : 0;
  const potongan = data.type === "Potongan" ? total : 0;
  const period = `${String(data.month).padStart(2, "0")}/${data.year}`;
  await db.insert(featureRecords).values({ companyId: context.companyId, module: "payroll", status: "Draft", createdBy: context.session.user.id, fields: {
    Periode: period, Karyawan: employee.name, "ID Karyawan": employee.id, "Tipe Gaji": data.type,
    Jumlah: String(data.quantity), Nominal: rupiah(data.nominal), Pendapatan: rupiah(pendapatan), Potongan: rupiah(potongan), "Gaji Bersih": rupiah(pendapatan - potongan),
  } });
  revalidatePath("/dashboard/payroll");
  redirect("/dashboard/payroll");
}
