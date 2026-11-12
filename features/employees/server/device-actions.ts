"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, session } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type DeviceResult = { ok: true; removed: number } | { ok: false; error: string };

/**
 * Logs the employee out of some (sessionIds) or all devices, e.g. when a phone is lost or replaced.
 * Only sessions of the employee's own login account can be removed.
 */
export async function signOutEmployeeDevices(employeeId: string, sessionIds: string[] | "all"): Promise<DeviceResult> {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const ids = sessionIds === "all" ? "all" : z.array(z.string().min(1).max(200)).min(1).max(100).safeParse(sessionIds).data;
  if (!ids) return { ok: false, error: "Perangkat tidak valid." };
  const [employee] = await db.select({ userId: employees.userId }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  if (!employee.userId) return { ok: false, error: "Karyawan ini belum punya akun login." };
  const removed = await db.delete(session)
    .where(ids === "all" ? eq(session.userId, employee.userId) : and(eq(session.userId, employee.userId), inArray(session.id, ids)))
    .returning({ id: session.id });
  revalidatePath(`/dashboard/karyawan/${employeeId}`);
  return { ok: true, removed: removed.length };
}
