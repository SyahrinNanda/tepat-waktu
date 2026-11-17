import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";

export type PopupAnnouncement = { id: string; title: string; content: string; imageAssetId: string | null; createdAt: string; version: string };

/** Recent published announcements (newest first) offered as the after-login popup. */
export async function popupAnnouncements(companyId: string, days = 30): Promise<PopupAnnouncement[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.select({ id: announcements.id, title: announcements.title, content: announcements.content, imageAssetId: announcements.imageAssetId, createdAt: announcements.createdAt, updatedAt: announcements.updatedAt })
    .from(announcements)
    .where(and(eq(announcements.companyId, companyId), eq(announcements.status, "published"), gte(announcements.createdAt, since)))
    .orderBy(desc(announcements.createdAt)).limit(5);
  // `version` changes when the admin edits the text, so "jangan tampilkan lagi" applies to that text only.
  return rows.map((row) => ({ id: row.id, title: row.title, content: row.content, imageAssetId: row.imageAssetId, createdAt: row.createdAt.toISOString(), version: String(row.updatedAt.getTime()) }));
}
