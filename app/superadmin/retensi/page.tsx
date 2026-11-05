import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { RetentionPage } from "@/features/subscriptions/pages/retention-page";

export const metadata: Metadata = { title: "Retensi Pelanggan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSuperAdmin();
  const { tab } = await searchParams;
  return <RetentionPage tab={tab} />;
}
