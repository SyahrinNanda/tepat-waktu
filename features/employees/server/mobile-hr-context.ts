import { z } from "zod";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";

/** Mobile API guard for employee administration: HRD and General Manager only (admins use the web). */
export async function mobileHrContext(request: Request) {
  const context = await selfAttendanceContext(request);
  if (!["hrd", "general_manager"].includes(context.role)) throw new AttendanceError("Akses ditolak.", 403);
  return context;
}
export const uuidParam = (value: string) => z.uuid().safeParse(value).success;
export function mobileFailure(error: unknown, label: string) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error(label, error);
  return Response.json({ error: "Permintaan belum dapat diproses." }, { status: 500 });
}
