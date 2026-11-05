import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AttendanceError,
  getSelfAttendanceStatus,
  recordAttendanceEvent,
  requestMetadata,
  selfAttendanceContext,
  uploadAttendancePhoto,
} from "@/features/attendance/server/attendance-service";
import { attendanceIpError } from "@/features/attendance/server/ip-whitelist";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";

const payloadSchema = z.object({
  action: z.enum(["check_in", "check_out"]),
  clientCapturedAt: z.iso.datetime().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracyMeters: z.coerce.number().min(0).max(100_000).optional(),
});

export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const [status, networkError] = await Promise.all([getSelfAttendanceStatus(context), attendanceIpError(context.companyId, clientIp(request.headers))]);
    return NextResponse.json({ ...status, networkError });
  } catch (error) {
    return attendanceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let uploaded: Awaited<ReturnType<typeof uploadAttendancePhoto>> | null = null;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 6 * 1024 * 1024) throw new AttendanceError("Ukuran request terlalu besar.", 413);
    const context = await selfAttendanceContext(request);
    // IP whitelist is checked before the photo is uploaded.
    const networkError = await attendanceIpError(context.companyId, clientIp(request.headers));
    if (networkError) throw new AttendanceError(networkError, 403);
    const form = await request.formData();
    const parsed = payloadSchema.parse(Object.fromEntries(form));
    const photo = form.get("photo");
    if (!(photo instanceof File)) throw new AttendanceError("Foto langsung dari kamera wajib disertakan.");
    uploaded = await uploadAttendancePhoto(photo, { companyId: context.companyId, employeeId: context.employeeId, action: parsed.action, actorId: context.userId });
    const result = await recordAttendanceEvent({
      actorId: context.userId,
      companyId: context.companyId,
      employeeId: context.employeeId,
      timezone: context.timezone,
      action: parsed.action,
      source: "self",
      clientCapturedAt: parsed.clientCapturedAt ? new Date(parsed.clientCapturedAt) : null,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      accuracyMeters: parsed.accuracyMeters,
      ...requestMetadata(request),
      photo: uploaded,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return attendanceErrorResponse(error);
  }
}

function attendanceErrorResponse(error: unknown) {
  if (error instanceof AttendanceError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ message: "Data presensi tidak valid.", issues: error.issues }, { status: 400 });
  console.error("Attendance API error", error);
  return NextResponse.json({ message: "Presensi belum dapat diproses." }, { status: 500 });
}
