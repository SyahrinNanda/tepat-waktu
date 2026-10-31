import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLocations } from "@/db/schema";
import { AttendanceLocationManager } from "@/features/master-data/attendance-locations/components/attendance-location-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Lokasi Presensi" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const rows = await db.select().from(attendanceLocations).where(eq(attendanceLocations.companyId, context.companyId)).orderBy(asc(attendanceLocations.name));
  return <AttendanceLocationManager initialRows={rows} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
