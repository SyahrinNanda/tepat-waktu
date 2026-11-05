import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformAnnouncements } from "@/db/schema";

export type TenantAnnouncement = {
  id: string; title: string; message: string; tone: "info" | "feature" | "maintenance" | "warning";
  linkUrl: string | null; linkLabel: string | null; version: string;
};

/** Announcements currently live for one company and member role. */
export async function activeAnnouncementsFor(companyId: string, role: string, now = new Date()): Promise<TenantAnnouncement[]> {
  const isAdmin = role === "admin" || role === "owner";
  const rows = await db.select().from(platformAnnouncements).where(and(
    eq(platformAnnouncements.active, true),
    lte(platformAnnouncements.startsAt, now),
    or(isNull(platformAnnouncements.endsAt), gt(platformAnnouncements.endsAt, now)),
    or(isNull(platformAnnouncements.companyIds), sql`${companyId}::uuid = ANY(${platformAnnouncements.companyIds})`),
    isAdmin ? undefined : eq(platformAnnouncements.audience, "all"),
  )).orderBy(desc(platformAnnouncements.startsAt)).limit(5);
  return rows.map((row) => ({
    id: row.id, title: row.title, message: row.message, tone: row.tone, linkUrl: row.linkUrl, linkLabel: row.linkLabel,
    // Editing an announcement shows it again to people who dismissed the old text.
    version: row.updatedAt.toISOString(),
  }));
}

export function announcementState(row: { active: boolean; startsAt: Date; endsAt: Date | null }, now = new Date()) {
  if (!row.active) return { label: "Nonaktif", tone: "gray" } as const;
  if (row.startsAt > now) return { label: "Terjadwal", tone: "orange" } as const;
  if (row.endsAt && row.endsAt <= now) return { label: "Selesai", tone: "gray" } as const;
  return { label: "Tayang", tone: "green" } as const;
}
