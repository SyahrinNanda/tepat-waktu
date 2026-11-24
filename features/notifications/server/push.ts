import { after } from "next/server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, employees, pushTokens } from "@/db/schema";

/**
 * Push notifications for the mobile app through the Expo Push API.
 * Messages are sent after the response (next/server `after`), so a slow or failing push
 * service never delays or breaks the request that triggered it.
 */
export type PushMessage = { title: string; body: string; href: string };

const PUSH_URL = () => process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";
const REVIEWER_ROLES = ["admin", "owner", "general_manager", "hrd"] as const;
const COMPLAINT_ROLES = ["admin", "owner", "hrd"] as const;
export const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;

type Ticket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/** Sends one message to every registered device of the given users; drops tokens Expo reports as gone. */
export async function sendPush(userIds: string[], message: PushMessage) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { sent: 0 };
  const tokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(inArray(pushTokens.userId, ids));
  let sent = 0;
  for (let index = 0; index < tokens.length; index += 100) {
    const chunk = tokens.slice(index, index + 100);
    const response = await fetch(PUSH_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(chunk.map(({ token }) => ({ to: token, title: message.title, body: message.body, data: { href: message.href }, sound: "default", channelId: "default", priority: "high" }))),
    });
    if (!response.ok) throw new Error(`Expo push ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const tickets = ((await response.json()) as { data?: Ticket[] }).data ?? [];
    const gone = chunk.filter((_, i) => tickets[i]?.details?.error === "DeviceNotRegistered").map(({ token }) => token);
    if (gone.length) await db.delete(pushTokens).where(inArray(pushTokens.token, gone));
    sent += tickets.filter((ticket) => ticket.status === "ok").length;
  }
  return { sent };
}

/** Queues a push after the current response; errors are logged, never thrown. */
function queue(task: () => Promise<string[]>, message: PushMessage) {
  const run = async () => { try { await sendPush(await task(), message); } catch (error) { console.error("Push notification failed", error); } };
  try { after(run); } catch { void run(); }
}

const membersWithRoles = async (companyId: string, roles: readonly string[], exceptUserId?: string | null) =>
  (await db.select({ userId: companyMembers.userId }).from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.isActive, true), inArray(companyMembers.role, roles as never[]), exceptUserId ? ne(companyMembers.userId, exceptUserId) : undefined)))
    .map((row) => row.userId);

const usersOfEmployees = async (companyId: string, employeeIds: string[]) => employeeIds.length
  ? (await db.select({ userId: employees.userId }).from(employees).where(and(eq(employees.companyId, companyId), inArray(employees.id, employeeIds)))).map((row) => row.userId).filter((id): id is string => Boolean(id))
  : [];

/** A new leave/overtime request: tell HRD, GM and admins (not the requester). */
export function pushToReviewers(companyId: string, requesterUserId: string | null, message: PushMessage) {
  queue(() => membersWithRoles(companyId, REVIEWER_ROLES, requesterUserId), message);
}
/** A decision on requests: tell each requester. */
export function pushToEmployees(companyId: string, employeeIds: string[], message: PushMessage) {
  queue(() => usersOfEmployees(companyId, employeeIds), message);
}
/** A new complaint: tell HRD and admins. */
export function pushToComplaintHandlers(companyId: string, message: PushMessage) {
  queue(() => membersWithRoles(companyId, COMPLAINT_ROLES), message);
}
/** A published announcement: tell everyone in the company except the author. */
export function pushToCompany(companyId: string, exceptUserId: string | null, message: PushMessage) {
  queue(async () => (await db.select({ userId: companyMembers.userId }).from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.isActive, true), exceptUserId ? ne(companyMembers.userId, exceptUserId) : undefined))).map((row) => row.userId), message);
}

const leaveLabels: Record<string, string> = { annual: "Cuti Tahunan", sick: "Izin Sakit", permission: "Izin", special: "Cuti Khusus" };
export const leaveLabel = (type: string, special?: string | null) => (type === "special" && special ? `Cuti Khusus (${special})` : leaveLabels[type] ?? "Izin/Cuti");
export const verdictLabel = (status: string) => (status === "approved" ? "disetujui" : "ditolak");
