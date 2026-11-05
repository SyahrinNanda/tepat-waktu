import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { AnnouncementsPage } from "@/features/platform-admin/pages/announcements-page";

export const metadata: Metadata = { title: "Pengumuman Platform" };

export default async function Page() {
  await requireSuperAdmin();
  return <AnnouncementsPage />;
}
