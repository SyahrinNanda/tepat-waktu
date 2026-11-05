import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComplaintCharts } from "@/features/complaints/components/complaint-charts";
import { ComplaintHeader, ComplaintTable, OwnComplaintList } from "@/features/complaints/components/complaint-lists";
import { complaintContext, complaintStats, listCompanyComplaints, listOwnComplaints } from "@/features/complaints/server/complaint-service";
import { dateInTimeZone } from "@/lib/current-company";

export const metadata: Metadata = { title: "Keluhan Karyawan" };

export default async function Page() {
  const context = await complaintContext();
  if (context.isSuperAdmin) redirect("/dashboard");
  if (!context.canHandle) {
    const rows = await listOwnComplaints(context.companyId, context.reporterKey);
    return <>
      <ComplaintHeader title="Keluhan Karyawan" description="Laporkan perlakuan tidak pantas di tempat kerja secara aman. Anda boleh melapor tanpa nama."/>
      <OwnComplaintList rows={rows}/>
    </>;
  }
  const rows = await listCompanyComplaints(context.companyId);
  const stats = complaintStats(rows, dateInTimeZone(context.timezone));
  return <>
    <ComplaintHeader title="Keluhan Karyawan" description="Rekap dan penanganan laporan keluhan. Hanya Admin dan HRD yang dapat membuka halaman ini."/>
    <ComplaintCharts stats={stats}/>
    <ComplaintTable rows={rows}/>
  </>;
}
