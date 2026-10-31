import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payrollTerms } from "@/db/schema";
import { PayrollTermManager } from "@/features/master-data/payroll-terms/components/payroll-term-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Istilah Gaji" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const rows = await db.select().from(payrollTerms).where(eq(payrollTerms.companyId, context.companyId)).orderBy(asc(payrollTerms.name));
  return <PayrollTermManager initialRows={rows} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
