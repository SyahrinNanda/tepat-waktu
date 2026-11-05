import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, employeeDocuments, employeeSalaryComponents, employeeSalaryProfiles, employees } from "@/db/schema";
import { SalaryManager } from "@/features/employee-salaries/components/salary-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Gaji Karyawan" };

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [team, components, divisionRows] = await Promise.all([
    db.select({
      id: employees.id, name: employees.name, email: employees.email, department: employees.department, position: employees.position,
      photoAssetId: employeeDocuments.assetId, baseSalary: employeeSalaryProfiles.baseSalary, overtimeRate: employeeSalaryProfiles.overtimeRate, salaryBasis: employeeSalaryProfiles.salaryBasis,
    }).from(employees)
      .leftJoin(employeeDocuments, and(eq(employeeDocuments.employeeId, employees.id), eq(employeeDocuments.kind, "profile_photo")))
      .leftJoin(employeeSalaryProfiles, eq(employeeSalaryProfiles.employeeId, employees.id))
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name)),
    db.select({ id: employeeSalaryComponents.id, employeeId: employeeSalaryComponents.employeeId, name: employeeSalaryComponents.name, type: employeeSalaryComponents.type, unit: employeeSalaryComponents.unit, amount: employeeSalaryComponents.amount })
      .from(employeeSalaryComponents).where(eq(employeeSalaryComponents.companyId, context.companyId)).orderBy(asc(employeeSalaryComponents.name)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions)
      .where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
  ]);
  const byEmployee = Map.groupBy(components, (component) => component.employeeId);
  const rows = team.map((employee) => {
    const employeeComponents = byEmployee.get(employee.id) ?? [];
    const serialize = (type: "compensation" | "deduction") => employeeComponents.filter((item) => item.type === type).map(({ id, name, unit, amount }) => ({ id, name, unit, amount }));
    return { ...employee, baseSalary: employee.baseSalary ?? 0, overtimeRate: employee.overtimeRate ?? 0, salaryBasis: employee.salaryBasis ?? "monthly", compensations: serialize("compensation"), deductions: serialize("deduction") };
  });
  return <SalaryManager initialRows={rows} divisions={divisionRows}/>;
}
