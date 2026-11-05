import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { CouponsPage } from "@/features/platform-admin/pages/coupons-page";

export const metadata: Metadata = { title: "Kupon Diskon" };

export default async function Page() {
  await requireSuperAdmin();
  return <CouponsPage />;
}
