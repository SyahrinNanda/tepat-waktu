import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { PayrollSettingsForm } from "@/features/payroll/components/payroll-settings-form";
import { requireCompanyRole } from "@/lib/current-company";
import { savePayrollSettings } from "./actions";

export const metadata: Metadata = { title: "Pengaturan Payroll Presensi" };

function enabled(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value === "true";
}

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [stored] = await db
    .select({ fields: featureRecords.fields })
    .from(featureRecords)
    .where(
      and(
        eq(featureRecords.companyId, context.companyId),
        eq(featureRecords.module, "payroll/pengaturan"),
      ),
    )
    .limit(1);

  const values = stored?.fields ?? {};

  return (
    <div className="payroll-settings-page">
      <header className="payroll-settings-header">
        <small>Presensi Admin Panel</small>
        <h1>PENGATURAN PAYROLL PRESENSI</h1>
        <nav aria-label="Breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span>/</span>
          <span>Pengaturan Payroll Presensi</span>
        </nav>
      </header>

      <section className="payroll-settings-card">
        <PayrollSettingsForm
          action={savePayrollSettings}
          values={{
            note: values.note ?? "",
            leaveCalculation: enabled(values.leaveCalculation, values.includeLeave === "true"),
            countSickAsLeave: enabled(values.countSickAsLeave),
            leaveSickPercentage: Number(values.leaveSickPercentage ?? 0),
            overtimeCalculation: enabled(values.overtimeCalculation, values.includeOvertime !== "false"),
            showCompensationDeduction: enabled(values.showCompensationDeduction),
          }}
        />
      </section>
    </div>
  );
}
