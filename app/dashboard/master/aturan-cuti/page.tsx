import type { Metadata } from "next";
import { LeaveRulesForm } from "@/features/leave-reports/components/leave-rules-form";
import { getLeaveRules } from "@/features/leave-requests/server/annual-balance";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Aturan Cuti" };

/** Master Data → Aturan Cuti: company Cuti Tahunan rules. */
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const rules = await getLeaveRules(context.companyId);
  return <>
    <div className="master-page-head"><span>Master Data</span><h1>Aturan Cuti Tahunan</h1><p>Beranda / Master Data / Aturan Cuti</p></div>
    <section className="leave-rules-card"><LeaveRulesForm rules={rules}/></section>
  </>;
}
