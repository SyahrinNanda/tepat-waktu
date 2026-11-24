import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceEvents, employees, session } from "@/db/schema";
import { parseUserAgent, type EmployeeDeviceRow } from "@/features/employees/devices";

export type { EmployeeDeviceRow };

/**
 * Devices of one employee, grouped by browser user agent: active login sessions of their account plus the
 * devices recorded on their check-ins / check-outs.
 */
export async function employeeDevices(companyId: string, employeeId: string, userId: string | null): Promise<EmployeeDeviceRow[]> {
  const [sessions, events] = await Promise.all([
    userId ? db.select({ id: session.id, userAgent: session.userAgent, ipAddress: session.ipAddress, updatedAt: session.updatedAt }).from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, new Date()))) : Promise.resolve([]),
    db.select({ userAgent: attendanceEvents.userAgent, count: sql<number>`count(*)::int`, last: sql<Date>`max(${attendanceEvents.occurredAt})`, ip: sql<string | null>`(array_agg(${attendanceEvents.ipAddress} order by ${attendanceEvents.occurredAt} desc))[1]` })
      .from(attendanceEvents).where(and(eq(attendanceEvents.companyId, companyId), eq(attendanceEvents.employeeId, employeeId))).groupBy(attendanceEvents.userAgent),
  ]);
  const devices = new Map<string, EmployeeDeviceRow & { lastIpAt: number }>();
  const entry = (userAgent: string | null) => {
    const key = userAgent?.trim() || "unknown";
    let row = devices.get(key);
    if (!row) { const parsed = parseUserAgent(userAgent); row = { key, ...parsed, lastUsed: new Date(0).toISOString(), lastIp: null, lastIpAt: 0, attendanceCount: 0, lastAttendance: null, sessionIds: [] }; devices.set(key, row); }
    return row;
  };
  const seen = (row: EmployeeDeviceRow & { lastIpAt: number }, at: Date, ip: string | null) => {
    if (at.toISOString() > row.lastUsed) row.lastUsed = at.toISOString();
    if (ip && at.getTime() >= row.lastIpAt) { row.lastIp = ip; row.lastIpAt = at.getTime(); }
  };
  for (const item of events) { const row = entry(item.userAgent); const last = new Date(item.last); row.attendanceCount += item.count; row.lastAttendance = last.toISOString(); seen(row, last, item.ip); }
  for (const item of sessions) { const row = entry(item.userAgent); row.sessionIds.push(item.id); seen(row, item.updatedAt, item.ipAddress); }
  return [...devices.values()].map(({ lastIpAt, ...row }) => { void lastIpAt; return row; }).sort((a, b) => Number(b.sessionIds.length > 0) - Number(a.sessionIds.length > 0) || b.lastUsed.localeCompare(a.lastUsed));
}

/**
 * Logs the employee out of some (sessionIds) or all devices, e.g. when a phone is lost or replaced.
 * Only sessions of the employee's own login account can be removed. Callers check the role first.
 */
export async function signOutDevicesFor(companyId: string, employeeId: string, ids: string[] | "all"): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const [employee] = await db.select({ userId: employees.userId }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  if (!employee.userId) return { ok: false, error: "Karyawan ini belum punya akun login." };
  const removed = await db.delete(session)
    .where(ids === "all" ? eq(session.userId, employee.userId) : and(eq(session.userId, employee.userId), inArray(session.id, ids)))
    .returning({ id: session.id });
  return { ok: true, removed: removed.length };
}
