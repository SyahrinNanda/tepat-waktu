import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employeeSalaryProfiles, employees, payrollTerms } from "@/db/schema";
import { PayrollListManager } from "@/features/payroll/components/payroll-list-manager";
import { listPayrolls } from "@/features/payroll/server/payroll-service";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan Daftar Payroll" };

export default async function Page() {
  const context = await requireCompanyRole([
    "admin",
    "general_manager",
    "hrd",
    "manager",
  ]);

  const [rows, employeeRows, termRows] = await Promise.all([
    listPayrolls(context.companyId),
    db
      .select({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
        baseSalary: employeeSalaryProfiles.baseSalary,
      })
      .from(employees)
      .leftJoin(
        employeeSalaryProfiles,
        eq(employees.id, employeeSalaryProfiles.employeeId),
      )
      .where(
        and(
          eq(employees.companyId, context.companyId),
          eq(employees.status, "active"),
        ),
      )
      .orderBy(asc(employees.name)),
    db
      .select({
        id: payrollTerms.id,
        name: payrollTerms.name,
        type: payrollTerms.type,
        active: payrollTerms.active,
      })
      .from(payrollTerms)
      .where(eq(payrollTerms.companyId, context.companyId))
      .orderBy(asc(payrollTerms.name)),
  ]);

  const canWrite = ["admin", "general_manager", "hrd"].includes(context.role);

  return (
    <PayrollListManager
      initialRows={rows}
      employees={employeeRows.map((e) => ({
        id: e.id,
        name: e.name,
        employeeCode: e.employeeCode,
        baseSalary: e.baseSalary ?? undefined,
      }))}
      terms={termRows}
      canWrite={canWrite}
    />
  );
}
