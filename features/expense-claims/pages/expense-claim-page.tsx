import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, expenseClaims } from "@/db/schema";
import { ExpenseClaimManager } from "@/features/expense-claims/components/expense-claim-manager";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Pengajuan Klaim Beban" };
export default async function Page() {
  const context = await requireCompany(); const canReview = ["admin", "owner", "general_manager", "hrd", "manager"].includes(context.role);
  const [team, rows] = await Promise.all([
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(asc(employees.name)),
    db.select({ id: expenseClaims.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, requestDate: expenseClaims.requestDate, amount: expenseClaims.amount, description: expenseClaims.description, note: expenseClaims.note, proofAssetId: expenseClaims.proofAssetId, status: expenseClaims.status }).from(expenseClaims).innerJoin(employees, eq(expenseClaims.employeeId, employees.id)).where(and(eq(expenseClaims.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(desc(expenseClaims.createdAt)),
  ]);
  return <ExpenseClaimManager initialRows={rows} employees={team} canReview={canReview} today={dateInTimeZone(context.timezone)}/>;
}
