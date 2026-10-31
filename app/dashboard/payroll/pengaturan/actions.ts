"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type PayrollSettingsState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function savePayrollSettings(_previousState: PayrollSettingsState, form: FormData): Promise<PayrollSettingsState> {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const leaveCalculation = form.has("leaveCalculation");
  const parsed = z.object({
    note: z.string().trim().max(1000),
    leaveSickPercentage: z.coerce.number().min(0).max(100),
  }).safeParse({
    note: form.get("note"),
    leaveSickPercentage: leaveCalculation ? form.get("leaveSickPercentage") : 0,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Pengaturan payroll tidak valid." };
  }
  const fields = {
    note: parsed.data.note,
    leaveCalculation: String(leaveCalculation),
    countSickAsLeave: String(leaveCalculation && form.has("countSickAsLeave")),
    leaveSickPercentage: String(leaveCalculation ? parsed.data.leaveSickPercentage : 0),
    overtimeCalculation: String(form.has("overtimeCalculation")),
    showCompensationDeduction: String(form.has("showCompensationDeduction")),
  };
  try {
    const [existing] = await db.select({ id: featureRecords.id }).from(featureRecords).where(and(eq(featureRecords.companyId, context.companyId), eq(featureRecords.module, "payroll/pengaturan"))).limit(1);
    if (existing) await db.update(featureRecords).set({ fields, updatedAt: new Date(), updatedBy: context.session.user.id }).where(eq(featureRecords.id, existing.id));
    else await db.insert(featureRecords).values({ companyId: context.companyId, module: "payroll/pengaturan", fields, createdBy: context.session.user.id });
    revalidatePath("/dashboard/payroll/pengaturan");
    revalidatePath("/dashboard/payroll");
    return { status: "success", message: "Pengaturan payroll berhasil disimpan." };
  } catch (error) {
    console.error("Gagal menyimpan pengaturan payroll", error);
    return { status: "error", message: "Pengaturan payroll gagal disimpan. Silakan coba lagi." };
  }
}
