import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { AnnouncementManager } from "@/features/announcements/components/announcement-manager";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Pengumuman" };

export default async function Page() {
  const context = await requireCompany();
  const rows = await db.select().from(announcements).where(eq(announcements.companyId, context.companyId)).orderBy(desc(announcements.createdAt)).limit(500);
  const canManage = ["admin", "owner", "general_manager", "hrd"].includes(context.role);
  return <AnnouncementManager canManage={canManage} initialRows={rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))} />;
}
