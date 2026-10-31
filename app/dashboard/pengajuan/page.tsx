import type { Metadata } from "next";
import { LeaveRequestModule } from "@/features/leave-requests/components/leave-request-module";

export const metadata: Metadata = { title: "Pengajuan" };

export default function RequestsPage() {
  return <LeaveRequestModule />;
}
