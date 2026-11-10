import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { attendanceLocations, employeeAttendanceLocations } from "@/db/schema";

/** Active work locations shown in the employee form's location list. */
export function activeLocationOptions(companyId: string) {
  return db.select({ id: attendanceLocations.id, name: attendanceLocations.name, address: attendanceLocations.address, radiusMeters: attendanceLocations.radiusMeters })
    .from(attendanceLocations).where(and(eq(attendanceLocations.companyId, companyId), eq(attendanceLocations.active, true))).orderBy(asc(attendanceLocations.name));
}

/** Location ids chosen for one employee ("Lokasi Tertentu"). */
export async function employeeLocationIds(employeeId: string) {
  const rows = await db.select({ id: employeeAttendanceLocations.locationId }).from(employeeAttendanceLocations).where(eq(employeeAttendanceLocations.employeeId, employeeId));
  return rows.map((row) => row.id);
}

/**
 * Reads "Semua Lokasi Perusahaan" + the picked `attendanceLocationIds` from the employee form.
 * "Lokasi Tertentu" needs at least one active location of this company.
 */
export async function parseEmployeeLocations(form: FormData, companyId: string) {
  const all = form.get("allAttendanceLocations") === "on";
  if (all) return { all, ids: [] as string[] };
  const ids = [...new Set(z.array(z.uuid()).parse(form.getAll("attendanceLocationIds").filter((value) => typeof value === "string")))];
  const valid = ids.length ? await db.select({ id: attendanceLocations.id }).from(attendanceLocations)
    .where(and(eq(attendanceLocations.companyId, companyId), eq(attendanceLocations.active, true), inArray(attendanceLocations.id, ids))) : [];
  if (!valid.length) throw new Error("Pilih minimal satu lokasi kerja, atau centang Semua Lokasi Perusahaan.");
  return { all, ids: valid.map((row) => row.id) };
}

/** Replaces the employee's chosen locations (cleared when "Semua Lokasi Perusahaan" is on). */
export async function saveEmployeeLocations(employeeId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(employeeAttendanceLocations).where(eq(employeeAttendanceLocations.employeeId, employeeId));
    if (ids.length) await tx.insert(employeeAttendanceLocations).values(ids.map((locationId) => ({ employeeId, locationId })));
  });
}

/** Names of the employee's chosen locations, for the detail page. */
export async function employeeLocationNames(employeeId: string) {
  const rows = await db.select({ name: attendanceLocations.name }).from(employeeAttendanceLocations)
    .innerJoin(attendanceLocations, eq(attendanceLocations.id, employeeAttendanceLocations.locationId))
    .where(eq(employeeAttendanceLocations.employeeId, employeeId)).orderBy(asc(attendanceLocations.name));
  return rows.map((row) => row.name);
}
