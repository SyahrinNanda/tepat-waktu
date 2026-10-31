import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financialReports, financialTerms, user } from "@/db/schema";
import { FinancialReportManager } from "@/features/finance/components/financial-report-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan Keuangan" };
export default async function Page() { const context = await requireCompanyRole(["admin", "general_manager", "hrd"]); const [rows, terms] = await Promise.all([db.select({ id: financialReports.id, financialTermId: financialReports.financialTermId, termName: financialTerms.name, type: financialTerms.type, amount: financialReports.amount, description: financialReports.description, transactionDate: financialReports.transactionDate, creatorName: user.name }).from(financialReports).innerJoin(financialTerms, eq(financialTerms.id, financialReports.financialTermId)).innerJoin(user, eq(user.id, financialReports.createdBy)).where(eq(financialReports.companyId, context.companyId)).orderBy(desc(financialReports.transactionDate), desc(financialReports.createdAt)), db.select({ id: financialTerms.id, name: financialTerms.name, type: financialTerms.type, active: financialTerms.active }).from(financialTerms).where(and(eq(financialTerms.companyId, context.companyId), eq(financialTerms.active, true))).orderBy(asc(financialTerms.name))]); return <FinancialReportManager initialRows={rows} terms={terms} canManage/>; }
