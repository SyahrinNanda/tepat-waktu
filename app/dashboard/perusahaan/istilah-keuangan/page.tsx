import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { financialReports, financialTerms } from "@/db/schema";
import { FinancialTermManager } from "@/features/finance/components/financial-term-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Istilah Keuangan" };
export default async function Page() { const context = await requireCompanyRole(["admin", "general_manager", "hrd"]); const rows = await db.select({ id: financialTerms.id, name: financialTerms.name, type: financialTerms.type, active: financialTerms.active, transactionCount: sql<number>`count(${financialReports.id})::int` }).from(financialTerms).leftJoin(financialReports, eq(financialReports.financialTermId, financialTerms.id)).where(eq(financialTerms.companyId, context.companyId)).groupBy(financialTerms.id).orderBy(asc(financialTerms.name)); return <FinancialTermManager initialRows={rows} canManage/>; }
