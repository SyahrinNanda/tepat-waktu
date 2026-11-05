import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ComplaintDetail } from "@/features/complaints/components/complaint-detail";
import { complaintContext, getComplaint } from "@/features/complaints/server/complaint-service";

export const metadata: Metadata = { title: "Detail Keluhan" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ baru?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const context = await complaintContext();
  if (context.isSuperAdmin) redirect("/dashboard");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const complaint = await getComplaint(id, context);
  if (!complaint) notFound();
  return <ComplaintDetail complaint={complaint} justCreated={query.baru === "1"}/>;
}
