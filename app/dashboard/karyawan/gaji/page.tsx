import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, employeeDocuments, employeeSalaryComponents, employeeSalaryProfiles, employees, payrollTerms } from "@/db/schema";
import { SalaryManager } from "@/features/employee-salaries/components/salary-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Gaji Karyawan" };

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [team, components, terms, divisionRows] = await Promise.all([
    db.select({
      id: employees.id, name: employees.name, email: employees.email, department: employees.department, position: employees.position,
      photoAssetId: employeeDocuments.assetId, baseSalary: employeeSalaryProfiles.baseSalary, overtimeRate: employeeSalaryProfiles.overtimeRate,
    }).from(employees)
      .leftJoin(employeeDocuments, and(eq(employeeDocuments.employeeId, employees.id), eq(employeeDocuments.kind, "profile_photo")))
      .leftJoin(employeeSalaryProfiles, eq(employeeSalaryProfiles.employeeId, employees.id))
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name)),
    db.select({ id: employeeSalaryComponents.id, employeeId: employeeSalaryComponents.employeeId, payrollTermId: employeeSalaryComponents.payrollTermId, name: employeeSalaryComponents.name, type: employeeSalaryComponents.type, unit: employeeSalaryComponents.unit, amount: employeeSalaryComponents.amount })
      .from(employeeSalaryComponents).where(eq(employeeSalaryComponents.companyId, context.companyId)).orderBy(asc(employeeSalaryComponents.name)),
    db.select({ id: payrollTerms.id, name: payrollTerms.name, type: payrollTerms.type }).from(payrollTerms)
      .where(and(eq(payrollTerms.companyId, context.companyId), eq(payrollTerms.active, true))).orderBy(asc(payrollTerms.name)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions)
      .where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
  ]);
  const byEmployee = Map.groupBy(components, (component) => component.employeeId);
  const rows = team.map((employee) => {
    const employeeComponents = byEmployee.get(employee.id) ?? [];
    const serialize = (type: "compensation" | "deduction") => employeeComponents.filter((item) => item.type === type).map(({ id, payrollTermId, name, unit, amount }) => ({ id, payrollTermId, name, unit, amount }));
    return { ...employee, baseSalary: employee.baseSalary ?? 0, overtimeRate: employee.overtimeRate ?? 0, compensations: serialize("compensation"), deductions: serialize("deduction") };
  });
  return <SalaryManager initialRows={rows} terms={terms} divisions={divisionRows}/>;
}
