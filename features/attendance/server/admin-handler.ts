import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { attendanceEvents, attendanceLocations, attendances, employees, fileAssets, workSchedules } from "@/db/schema";
import {
  AttendanceError,
  attendanceManagerContext,
  deleteAttendanceWithPhotos,
  requestMetadata,
  uploadAttendancePhoto,
} from "@/features/attendance/server/attendance-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 15 * 1024 * 1024) throw new AttendanceError("Ukuran request terlalu besar (maksimal 15 MB).", 413);

    const form = await request.formData();
    const rawCompanyId = form.get("companyId") ? String(form.get("companyId")) : undefined;
    const context = await attendanceManagerContext(request, rawCompanyId);

    // Support both new comprehensive modal and legacy single-action payload
    const employeeId = String(form.get("employeeId") || "").trim();
    if (!employeeId) throw new AttendanceError("Karyawan wajib dipilih.", 400);

    const [employee] = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active")))
      .limit(1);

    if (!employee) throw new AttendanceError("Karyawan tidak ditemukan atau tidak aktif di perusahaan ini.", 404);

    const attendanceDate = String(form.get("attendanceDate") || form.get("date") || "").trim() ||
      new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(new Date());

    const checkInTime = String(form.get("checkInTime") || form.get("checkIn") || "").trim() || null;
    const checkOutTime = String(form.get("checkOutTime") || form.get("checkOut") || "").trim() || null;
    const breakStartTime = String(form.get("breakStartTime") || form.get("breakStart") || "").trim() || null;
    const breakEndTime = String(form.get("breakEndTime") || form.get("breakEnd") || "").trim() || null;
    const shiftId = String(form.get("shiftId") || "").trim() || null;
    const checkInLocationId = String(form.get("checkInLocationId") || "").trim() || null;
    const checkOutLocationId = String(form.get("checkOutLocationId") || "").trim() || null;
    // Referenced shift and locations must belong to this company.
    const parsedIds = z.uuid().nullable().array().safeParse([shiftId, checkInLocationId, checkOutLocationId]);
    if (!parsedIds.success) throw new AttendanceError("Shift atau lokasi kehadiran tidak valid.", 400);
    if (shiftId) {
      const [shift] = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.id, shiftId), eq(workSchedules.companyId, context.companyId))).limit(1);
      if (!shift) throw new AttendanceError("Shift tidak ditemukan di perusahaan ini.", 404);
    }
    for (const locationId of new Set([checkInLocationId, checkOutLocationId].filter((value): value is string => Boolean(value)))) {
      const [location] = await db.select({ id: attendanceLocations.id }).from(attendanceLocations).where(and(eq(attendanceLocations.id, locationId), eq(attendanceLocations.companyId, context.companyId))).limit(1);
      if (!location) throw new AttendanceError("Lokasi kehadiran tidak ditemukan di perusahaan ini.", 404);
    }
    const statusRaw = String(form.get("status") || "present").trim() as "present" | "late" | "absent" | "leave";
    const status = ["present", "late", "absent", "leave"].includes(statusRaw) ? statusRaw : "present";
    const note = String(form.get("note") || "Kehadiran dicatat oleh administrator").trim();

    // Check for legacy action
    const legacyAction = form.get("action");
    if (legacyAction === "check_in" || legacyAction === "check_out") {
      const occurredAtStr = form.get("occurredAt");
      const occurredAt = occurredAtStr ? new Date(String(occurredAtStr)) : new Date();
      const photo = form.get("photo");
      const uploaded = photo instanceof File && photo.size > 0
        ? await uploadAttendancePhoto(photo, { companyId: context.companyId, employeeId, action: legacyAction, actorId: context.userId })
        : null;

      const { recordAttendanceEvent } = await import("@/features/attendance/server/attendance-service");
      const result = await recordAttendanceEvent({
        actorId: context.userId,
        companyId: context.companyId,
        employeeId,
        timezone: context.timezone,
        action: legacyAction,
        source: context.source,
        occurredAt,
        note,
        ...requestMetadata(request),
        photo: uploaded,
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }

    // Modal submission handling
    const photoCheckIn = form.get("photoCheckIn");
    const photoCheckOut = form.get("photoCheckOut");

    const uploadedCheckIn = photoCheckIn instanceof File && photoCheckIn.size > 0
      ? await uploadAttendancePhoto(photoCheckIn, { companyId: context.companyId, employeeId, action: "check_in", actorId: context.userId })
      : null;

    const uploadedCheckOut = photoCheckOut instanceof File && photoCheckOut.size > 0
      ? await uploadAttendancePhoto(photoCheckOut, { companyId: context.companyId, employeeId, action: "check_out", actorId: context.userId })
      : null;

    const result = await db.transaction(async (tx) => {
      let [attendance] = await tx
        .select()
        .from(attendances)
        .where(and(eq(attendances.companyId, context.companyId), eq(attendances.employeeId, employeeId), eq(attendances.attendanceDate, attendanceDate)))
        .limit(1);

      const fmtTime = (t: string | null) => (t ? (t.length === 5 ? `${t}:00` : t) : null);
      if (!attendance) {
        [attendance] = await tx
          .insert(attendances)
          .values({
            companyId: context.companyId,
            employeeId,
            shiftId,
            checkInLocationId,
            checkOutLocationId,
            attendanceDate,
            checkIn: fmtTime(checkInTime),
            checkOut: fmtTime(checkOutTime),
            breakStart: fmtTime(breakStartTime),
            breakEnd: fmtTime(breakEndTime),
            status,
            note,
          })
          .returning();
      } else {
        const updateValues: Record<string, unknown> = {
          status,
          note,
          updatedAt: new Date(),
        };
        if (shiftId) updateValues.shiftId = shiftId;
        if (checkInLocationId) updateValues.checkInLocationId = checkInLocationId;
        if (checkOutLocationId) updateValues.checkOutLocationId = checkOutLocationId;
        if (checkInTime) updateValues.checkIn = fmtTime(checkInTime);
        if (checkOutTime) updateValues.checkOut = fmtTime(checkOutTime);
        if (breakStartTime) updateValues.breakStart = fmtTime(breakStartTime);
        if (breakEndTime) updateValues.breakEnd = fmtTime(breakEndTime);

        [attendance] = await tx
          .update(attendances)
          .set(updateValues)
          .where(eq(attendances.id, attendance.id))
          .returning();
      }

      // Check-in photo / event
      if (uploadedCheckIn || checkInTime) {
        let photoAssetId: string | null = null;
        if (uploadedCheckIn) {
          const [asset] = await tx.insert(fileAssets).values({
            companyId: context.companyId,
            ownerEmployeeId: employeeId,
            uploadedBy: context.userId,
            category: "attendance_photo",
            bucket: uploadedCheckIn.bucket,
            objectKey: uploadedCheckIn.key,
            originalName: uploadedCheckIn.originalName,
            contentType: uploadedCheckIn.contentType,
            byteSize: uploadedCheckIn.byteSize,
            checksumSha256: uploadedCheckIn.checksumSha256,
          }).returning({ id: fileAssets.id });
          photoAssetId = asset.id;
        }

        const occurredAt = new Date(`${attendanceDate}T${checkInTime || "08:00:00"}`);
        await tx.insert(attendanceEvents).values({
          attendanceId: attendance.id,
          companyId: context.companyId,
          employeeId,
          type: "check_in",
          source: context.source,
          photoAssetId,
          locationId: checkInLocationId,
          occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
          note,
          recordedBy: context.userId,
        }).onConflictDoUpdate({
          target: [attendanceEvents.attendanceId, attendanceEvents.type],
          set: {
            photoAssetId: photoAssetId ?? undefined,
            locationId: checkInLocationId ?? undefined,
            occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
            note,
          },
        });
      }

      // Check-out photo / event
      if (uploadedCheckOut || checkOutTime) {
        let photoAssetId: string | null = null;
        if (uploadedCheckOut) {
          const [asset] = await tx.insert(fileAssets).values({
            companyId: context.companyId,
            ownerEmployeeId: employeeId,
            uploadedBy: context.userId,
            category: "attendance_photo",
            bucket: uploadedCheckOut.bucket,
            objectKey: uploadedCheckOut.key,
            originalName: uploadedCheckOut.originalName,
            contentType: uploadedCheckOut.contentType,
            byteSize: uploadedCheckOut.byteSize,
            checksumSha256: uploadedCheckOut.checksumSha256,
          }).returning({ id: fileAssets.id });
          photoAssetId = asset.id;
        }

        const occurredAt = new Date(`${attendanceDate}T${checkOutTime || "17:00:00"}`);
        await tx.insert(attendanceEvents).values({
          attendanceId: attendance.id,
          companyId: context.companyId,
          employeeId,
          type: "check_out",
          source: context.source,
          photoAssetId,
          locationId: checkOutLocationId,
          occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
          note,
          recordedBy: context.userId,
        }).onConflictDoUpdate({
          target: [attendanceEvents.attendanceId, attendanceEvents.type],
          set: {
            photoAssetId: photoAssetId ?? undefined,
            locationId: checkOutLocationId ?? undefined,
            occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
            note,
          },
        });
      }

      return { attendanceId: attendance.id, employeeName: employee.name, date: attendanceDate };
    });

    return NextResponse.json({ ok: true, message: `Kehadiran ${result.employeeName} untuk tanggal ${result.date} berhasil disimpan.`, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Data kehadiran tidak valid.", issues: error.issues }, { status: 400 });
    console.error("Admin attendance API error", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Kehadiran belum dapat disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await attendanceManagerContext(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID kehadiran wajib diberikan." }, { status: 400 });

    if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "Kehadiran tidak ditemukan." }, { status: 404 });
    // Also removes the check-in/out photos from the database and object storage.
    if (!await deleteAttendanceWithPhotos(context.companyId, id)) return NextResponse.json({ message: "Kehadiran tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, message: "Kehadiran berhasil dihapus." });
  } catch (error) {
    if (error instanceof AttendanceError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Admin delete attendance error:", error);
    return NextResponse.json({ message: "Gagal menghapus kehadiran." }, { status: 500 });
  }
}
