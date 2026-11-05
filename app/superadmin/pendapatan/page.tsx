import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { RevenuePage } from "@/features/subscriptions/pages/revenue-page";

export const metadata: Metadata = { title: "Laporan Pendapatan" };

export default async function Page() {
  await requireSuperAdmin();
  return <RevenuePage />;
}
