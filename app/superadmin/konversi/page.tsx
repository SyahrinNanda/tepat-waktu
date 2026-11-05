import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { TrialFunnelPage } from "@/features/subscriptions/pages/trial-funnel-page";

export const metadata: Metadata = { title: "Konversi Trial" };

export default async function Page() {
  await requireSuperAdmin();
  return <TrialFunnelPage />;
}
