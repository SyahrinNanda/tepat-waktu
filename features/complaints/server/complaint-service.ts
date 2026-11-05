import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employeeComplaints } from "@/db/schema";
import { requireCompany } from "@/lib/current-company";
import { categoryKeys, statusKeys, type ComplaintCategory, type ComplaintStatus } from "../config";

/** Only Admin and HRD read complaints. Superadmin (platform staff) never sees complaint content. */
export async function complaintContext() {
  const context = await requireCompany();
  const role = context.role === "owner" ? "admin" : context.role;
  const canHandle = !context.isSuperAdmin && (role === "admin" || role === "hrd");
  return { ...context, role, canHandle, reporterKey: reporterKey(context.companyId, context.session.user.id) };
}

/** One-way key: the reporter can find their own reports; handlers cannot turn it back into a person. */
export function reporterKey(companyId: string, userId: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET belum dikonfigurasi.");
  return createHmac("sha256", secret).update(`complaint:${companyId}:${userId}`).digest("hex");
}

const reporterColumns = {
  id: employeeComplaints.id, ticketCode: employeeComplaints.ticketCode, category: employeeComplaints.category, title: employeeComplaints.title,
  description: employeeComplaints.description, incidentDate: employeeComplaints.incidentDate, incidentLocation: employeeComplaints.incidentLocation,
  involvedParties: employeeComplaints.involvedParties, anonymous: employeeComplaints.anonymous, status: employeeComplaints.status,
  responseNote: employeeComplaints.responseNote, handledAt: employeeComplaints.handledAt, createdAt: employeeComplaints.createdAt,
};
const handlerColumns = { ...reporterColumns, reporterName: employeeComplaints.reporterName, internalNote: employeeComplaints.internalNote };

export type ReporterComplaint = Awaited<ReturnType<typeof listOwnComplaints>>[number];
export type HandlerComplaint = Awaited<ReturnType<typeof listCompanyComplaints>>[number];

export function listOwnComplaints(companyId: string, key: string) {
  return db.select(reporterColumns).from(employeeComplaints)
    .where(and(eq(employeeComplaints.companyId, companyId), eq(employeeComplaints.reporterKey, key))).orderBy(desc(employeeComplaints.createdAt));
}

export function listCompanyComplaints(companyId: string) {
  return db.select(handlerColumns).from(employeeComplaints)
    .where(eq(employeeComplaints.companyId, companyId)).orderBy(desc(employeeComplaints.createdAt));
}

/** Handlers get the full record; a reporter only gets their own report, without internal notes. */
export async function getComplaint(id: string, context: Awaited<ReturnType<typeof complaintContext>>) {
  if (context.canHandle) {
    const [row] = await db.select(handlerColumns).from(employeeComplaints).where(and(eq(employeeComplaints.id, id), eq(employeeComplaints.companyId, context.companyId))).limit(1);
    return row ? { ...row, view: "handler" as const } : null;
  }
  const [row] = await db.select(reporterColumns).from(employeeComplaints)
    .where(and(eq(employeeComplaints.id, id), eq(employeeComplaints.companyId, context.companyId), eq(employeeComplaints.reporterKey, context.reporterKey))).limit(1);
  return row ? { ...row, view: "reporter" as const } : null;
}

export type ComplaintStats = {
  total: number;
  byStatus: Record<ComplaintStatus, number>;
  byCategory: { category: ComplaintCategory; count: number }[];
  byMonth: { key: string; label: string; count: number }[];
};

/** Recap for the handler dashboard: status tiles, category frequency, and the last six months. */
export function complaintStats(rows: { category: ComplaintCategory; status: ComplaintStatus; createdAt: Date }[], today: string): ComplaintStats {
  const byStatus = Object.fromEntries(statusKeys.map((key) => [key, 0])) as Record<ComplaintStatus, number>;
  const categoryCount = new Map<ComplaintCategory, number>(categoryKeys.map((key) => [key, 0]));
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - (5 - index), 1));
    return { key: date.toISOString().slice(0, 7), label: new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date), count: 0 };
  });
  for (const row of rows) {
    byStatus[row.status]++;
    categoryCount.set(row.category, (categoryCount.get(row.category) ?? 0) + 1);
    const month = months.find((item) => item.key === row.createdAt.toISOString().slice(0, 7));
    if (month) month.count++;
  }
  const byCategory = [...categoryCount].map(([category, count]) => ({ category, count })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  return { total: rows.length, byStatus, byCategory, byMonth: months };
}
