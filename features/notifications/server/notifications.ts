import { and, desc, eq, gte, ne, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { announcements, employeeComplaints, employees, leaveRequests, notificationReads, overtimeRequests } from "@/db/schema";

export type NotificationKind = "announcement" | "complaint" | "leave" | "overtime" | "leave_result" | "overtime_result";
export type NotificationItem = { id: string; kind: NotificationKind; title: string; body: string; href: string; at: string };
export type NotificationFeed = { items: NotificationItem[]; unread: number };

const REVIEWER_ROLES = ["admin", "owner", "general_manager", "hrd"];
const COMPLAINT_ROLES = ["admin", "owner", "hrd"];
const WINDOW_DAYS = 30;
const LIMIT = 30;

const leaveLabels: Record<string, string> = { annual: "Cuti", sick: "Izin Sakit", permission: "Izin", special: "Cuti Khusus" };
const leaveName = (type: string, special: string | null) => (type === "special" && special ? `Cuti Khusus (${special})` : leaveLabels[type] ?? "izin/cuti");
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const range = (start: string, end: string) => (start === end ? dateLabel(start) : `${dateLabel(start)} – ${dateLabel(end)}`);
const hours = (minutes: number) => [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} jam` : "", minutes % 60 ? `${minutes % 60} menit` : ""].filter(Boolean).join(" ") || "0 menit";

/**
 * The bell's feed for one user, built from the records themselves (so edits, approvals and deletions
 * are reflected without a separate notification store):
 * - everyone: announcements published by someone else;
 * - admin / GM / HRD: leave and overtime requests waiting for review (not their own);
 * - admin / HRD: new employee complaints;
 * - the requester: their leave / overtime request was approved or rejected.
 * Items newer than the user's last bell opening are unread.
 */
export async function notificationFeed(input: { companyId: string; userId: string; role: string; isSuperAdmin: boolean }): Promise<NotificationFeed> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const reviewer = REVIEWER_ROLES.includes(input.role);
  const complaintHandler = !input.isSuperAdmin && COMPLAINT_ROLES.includes(input.role);
  const notMine = or(isNull(employees.userId), ne(employees.userId, input.userId));

  const [news, leaves, overtimes, complaints, ownLeaves, ownOvertimes, [read]] = await Promise.all([
    db.select({ id: announcements.id, title: announcements.title, summary: announcements.summary, at: announcements.createdAt }).from(announcements)
      .where(and(eq(announcements.companyId, input.companyId), eq(announcements.status, "published"), ne(announcements.createdBy, input.userId), gte(announcements.createdAt, since)))
      .orderBy(desc(announcements.createdAt)).limit(LIMIT),
    reviewer ? db.select({ id: leaveRequests.id, type: leaveRequests.type, special: leaveRequests.specialLeaveName, start: leaveRequests.startDate, end: leaveRequests.endDate, name: employees.name, at: leaveRequests.createdAt })
      .from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(and(eq(leaveRequests.companyId, input.companyId), eq(leaveRequests.status, "pending"), notMine, gte(leaveRequests.createdAt, since)))
      .orderBy(desc(leaveRequests.createdAt)).limit(LIMIT) : [],
    reviewer ? db.select({ id: overtimeRequests.id, date: overtimeRequests.overtimeDate, minutes: overtimeRequests.durationMinutes, name: employees.name, at: overtimeRequests.createdAt })
      .from(overtimeRequests).innerJoin(employees, eq(employees.id, overtimeRequests.employeeId))
      .where(and(eq(overtimeRequests.companyId, input.companyId), eq(overtimeRequests.status, "pending"), notMine, gte(overtimeRequests.createdAt, since)))
      .orderBy(desc(overtimeRequests.createdAt)).limit(LIMIT) : [],
    complaintHandler ? db.select({ id: employeeComplaints.id, ticket: employeeComplaints.ticketCode, title: employeeComplaints.title, anonymous: employeeComplaints.anonymous, reporter: employeeComplaints.reporterName, at: employeeComplaints.createdAt })
      .from(employeeComplaints).where(and(eq(employeeComplaints.companyId, input.companyId), eq(employeeComplaints.status, "new"), gte(employeeComplaints.createdAt, since)))
      .orderBy(desc(employeeComplaints.createdAt)).limit(LIMIT) : [],
    db.select({ id: leaveRequests.id, type: leaveRequests.type, special: leaveRequests.specialLeaveName, start: leaveRequests.startDate, end: leaveRequests.endDate, status: leaveRequests.status, at: leaveRequests.reviewedAt })
      .from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(and(eq(leaveRequests.companyId, input.companyId), eq(employees.userId, input.userId), ne(leaveRequests.status, "pending"), gte(leaveRequests.reviewedAt, since)))
      .orderBy(desc(leaveRequests.reviewedAt)).limit(LIMIT),
    db.select({ id: overtimeRequests.id, date: overtimeRequests.overtimeDate, status: overtimeRequests.status, at: overtimeRequests.reviewedAt })
      .from(overtimeRequests).innerJoin(employees, eq(employees.id, overtimeRequests.employeeId))
      .where(and(eq(overtimeRequests.companyId, input.companyId), eq(employees.userId, input.userId), ne(overtimeRequests.status, "pending"), gte(overtimeRequests.reviewedAt, since)))
      .orderBy(desc(overtimeRequests.reviewedAt)).limit(LIMIT),
    db.select({ seenAt: notificationReads.seenAt }).from(notificationReads).where(eq(notificationReads.userId, input.userId)).limit(1),
  ]);

  const verdict = (status: string) => (status === "approved" ? "disetujui" : "ditolak");
  const items: NotificationItem[] = [
    ...news.map((row) => ({ id: `a-${row.id}`, kind: "announcement" as const, title: `Pemberitahuan: ${row.title}`, body: row.summary, href: "/dashboard/pengumuman", at: row.at.toISOString() })),
    ...leaves.map((row) => ({ id: `l-${row.id}`, kind: "leave" as const, title: `Pengajuan ${leaveName(row.type, row.special)} baru`, body: `${row.name} · ${range(row.start, row.end)} · menunggu persetujuan`, href: `/dashboard/pengajuan/izin-cuti/${row.id}`, at: row.at.toISOString() })),
    ...overtimes.map((row) => ({ id: `o-${row.id}`, kind: "overtime" as const, title: "Pengajuan lembur baru", body: `${row.name} · ${dateLabel(row.date)} · ${hours(row.minutes)} · menunggu persetujuan`, href: "/dashboard/pengajuan/lembur", at: row.at.toISOString() })),
    ...complaints.map((row) => ({ id: `c-${row.id}`, kind: "complaint" as const, title: `Keluhan baru: ${row.title}`, body: `${row.ticket} · ${row.anonymous ? "Anonim" : row.reporter ?? "Karyawan"}`, href: `/dashboard/karyawan/keluhan/${row.id}`, at: row.at.toISOString() })),
    ...ownLeaves.filter((row) => row.at).map((row) => ({ id: `lr-${row.id}`, kind: "leave_result" as const, title: `Pengajuan ${leaveName(row.type, row.special)} Anda ${verdict(row.status)}`, body: range(row.start, row.end), href: `/dashboard/pengajuan/izin-cuti/${row.id}`, at: row.at!.toISOString() })),
    ...ownOvertimes.filter((row) => row.at).map((row) => ({ id: `or-${row.id}`, kind: "overtime_result" as const, title: `Pengajuan lembur Anda ${verdict(row.status)}`, body: dateLabel(row.date), href: "/dashboard/pengajuan/lembur", at: row.at!.toISOString() })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);

  const seenAt = read?.seenAt.toISOString() ?? "";
  return { items, unread: items.filter((item) => item.at > seenAt).length };
}

export async function markNotificationsSeen(userId: string) {
  const now = new Date();
  await db.insert(notificationReads).values({ userId, seenAt: now }).onConflictDoUpdate({ target: notificationReads.userId, set: { seenAt: now } });
}
