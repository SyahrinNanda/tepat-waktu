"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyRole } from "@/lib/current-company";
import { signOutDevicesFor } from "./device-service";

export type DeviceResult = { ok: true; removed: number } | { ok: false; error: string };

/**
 * Logs the employee out of some (sessionIds) or all devices, e.g. when a phone is lost or replaced.
 * Only sessions of the employee's own login account can be removed.
 */
export async function signOutEmployeeDevices(employeeId: string, sessionIds: string[] | "all"): Promise<DeviceResult> {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const ids = sessionIds === "all" ? "all" : z.array(z.string().min(1).max(200)).min(1).max(100).safeParse(sessionIds).data;
  if (!ids) return { ok: false, error: "Perangkat tidak valid." };
  const result = await signOutDevicesFor(context.companyId, employeeId, ids);
  if (result.ok) revalidatePath(`/dashboard/karyawan/${employeeId}`);
  return result;
}
