import { createHash, randomUUID } from "node:crypto";
import { clientIp } from "@/lib/client-ip";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceEvents,
  attendanceLocations,
  attendances,
  companies,
  companyMembers,
  divisions,
  employees,
  fileAssets,
  user,
  workScheduleDays,
  workSchedules,
} from "@/db/schema";
import { getAppSession } from "@/lib/app-session";
import { deletePrivateObject, objectStorageBucket, putPrivateObject } from "@/lib/object-storage";
import { compressUpload, storedFileName } from "@/lib/file-compression";
import { ensureEmployeeRecord } from "./employee-link";
import { getSubscriptionStatus, SUBSCRIPTION_EXPIRED_MESSAGE } from "@/features/subscriptions/server/subscription-status";
import { selectedCompanyFromRequest } from "@/lib/selected-company";

export type AttendanceAction = "check_in" | "check_out";
type CompanyRole = "owner" | "admin" | "general_manager" | "hrd" | "manager" | "employee";
type EventSource = "self" | "admin" | "superadmin";

export class AttendanceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Actor = {
  userId: string;
  email: string;
  platformRole: "user" | "superadmin";
};

export type SelfAttendanceContext = Actor & {
  companyId: string;
  companyName: string;
  timezone: string;
  role: CompanyRole;
  employeeId: string;
  employeeName: string;
};

async function assertSubscriptionActive(companyId: string) {
  const status = await getSubscriptionStatus(companyId);
  if (status.state === "expired") throw new AttendanceError(SUBSCRIPTION_EXPIRED_MESSAGE, 402);
}

export async function authenticatedActor(request: Request): Promise<Actor> {
  const session = await getAppSession(request.headers);
  if (!session) throw new AttendanceError("Sesi tidak ditemukan.", 401);
  const [account] = await db.select({ platformRole: user.platformRole }).from(user).where(eq(user.id, session.user.id)).limit(1);
  return { userId: session.user.id, email: session.user.email, platformRole: account?.platformRole ?? "user" };
}

export async function selfAttendanceContext(request: Request): Promise<SelfAttendanceContext> {
  const actor = await authenticatedActor(request);
  if (actor.platformRole === "superadmin") throw new AttendanceError("Super Admin tidak diwajibkan melakukan presensi.", 403);

  const [membership] = await db
    .select({ companyId: companyMembers.companyId, companyName: companies.name, timezone: companies.timezone, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, actor.userId))
    .limit(1);
  if (!membership) throw new AttendanceError("Keanggotaan perusahaan tidak ditemukan.", 403);
  await assertSubscriptionActive(membership.companyId);
  if (membership.role === "admin" || membership.role === "owner") {
    throw new AttendanceError("Admin Perusahaan tidak diwajibkan melakukan presensi.", 403);
  }

  let [employee] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(eq(employees.companyId, membership.companyId), eq(employees.userId, actor.userId), eq(employees.status, "active")))
    .limit(1);

  // Safe one-time linking for invited accounts whose employee email already
  // matches the verified Better Auth identity.
  if (!employee) {
    [employee] = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.companyId, membership.companyId), eq(employees.email, actor.email.toLowerCase()), eq(employees.status, "active")))
      .limit(1);
    if (employee) await db.update(employees).set({ userId: actor.userId }).where(and(eq(employees.id, employee.id), eq(employees.companyId, membership.companyId)));
  }
  // Members without an employee record yet (e.g. GM/HRD/Manager accounts) get one, so they can check in like staff.
  if (!employee) {
    const [account] = await db.select({ name: user.name }).from(user).where(eq(user.id, actor.userId)).limit(1);
    const linked = await ensureEmployeeRecord({ companyId: membership.companyId, userId: actor.userId, name: account?.name ?? actor.email, email: actor.email, role: membership.role });
    if (linked) employee = linked;
  }
  if (!employee) throw new AttendanceError("Akun belum terhubung ke data karyawan aktif.", 409);

  return { ...actor, ...membership, employeeId: employee.id, employeeName: employee.name };
}

export async function attendanceManagerContext(request: Request, requestedCompanyId?: string | null) {
  const actor = await authenticatedActor(request);
  if (actor.platformRole === "superadmin") {
    const selectedCompanyId = requestedCompanyId ?? selectedCompanyFromRequest(request);
    if (!selectedCompanyId) throw new AttendanceError("Perusahaan wajib dipilih oleh Super Admin.", 400);
    const [company] = await db.select({ id: companies.id, name: companies.name, timezone: companies.timezone }).from(companies).where(eq(companies.id, selectedCompanyId)).limit(1);
    if (!company) throw new AttendanceError("Perusahaan tidak ditemukan.", 404);
    return { ...actor, companyId: company.id, companyName: company.name, timezone: company.timezone, source: "superadmin" as const };
  }

  const conditions = requestedCompanyId
    ? and(eq(companyMembers.userId, actor.userId), eq(companyMembers.companyId, requestedCompanyId))
    : eq(companyMembers.userId, actor.userId);
  const [membership] = await db
    .select({ companyId: companyMembers.companyId, companyName: companies.name, timezone: companies.timezone, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(conditions)
    .limit(1);
  if (!membership || !["admin", "owner"].includes(membership.role)) {
    throw new AttendanceError("Hanya Admin Perusahaan yang dapat menambahkan presensi karyawan lain.", 403);
  }
  await assertSubscriptionActive(membership.companyId);
  return { ...actor, ...membership, source: "admin" as const };
}

type UploadedPhoto = {
  bucket: string;
  key: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
};

function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  throw new AttendanceError("Format foto harus JPEG, PNG, atau WebP.", 415);
}

export async function uploadAttendancePhoto(file: File, input: { companyId: string; employeeId: string; action: AttendanceAction; actorId: string }): Promise<UploadedPhoto> {
  if (file.size < 1_000) throw new AttendanceError("Foto kamera tidak valid atau terlalu kecil.");
  if (file.size > 5 * 1024 * 1024) throw new AttendanceError("Ukuran foto maksimal 5 MB.", 413);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(sourceBytes);
  const compressed = await compressUpload(sourceBytes, detected.contentType, detected.extension, "selfie");
  const bytes = compressed.bytes;
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const key = `companies/${input.companyId}/attendance/${input.employeeId}/${new Date().toISOString().slice(0, 10)}/${input.action}-${randomUUID()}.${compressed.extension}`;
  const stored = await putPrivateObject({
    key,
    body: bytes,
    contentType: compressed.contentType,
    storageCompression: compressed.storageCompression,
    metadata: { company: input.companyId, employee: input.employeeId, action: input.action, uploader: input.actorId, sha256: checksumSha256, uploadQuality: String(compressed.quality ?? "original") },
  });
  return { ...stored, originalName: storedFileName(file.name, input.action, compressed.extension), contentType: compressed.contentType, byteSize: bytes.byteLength, checksumSha256 };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}:${value("second")}` };
}

function isLate(actual: string, start: string, graceMinutes: number) {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  return minutes(actual) > minutes(start) + graceMinutes;
}

function weekdayNumber(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function distanceInMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The work schedule that applies to one employee on one date. Used by both the check-in screen and
 * the recorder, so what the employee sees is exactly what lateness is judged against.
 * - source "division": the active schedule of the employee's active division;
 * - source "company":  otherwise the company's oldest active schedule;
 * - source "default":  no schedule configured yet: 08:00–17:00 is shown, but lateness is not judged.
 * The schedule's row for that weekday overrides its times; a disabled row makes it a day off.
 */
export type ResolvedSchedule = { name: string; startTime: string; endTime: string; graceMinutes: number; isWorkday: boolean; source: "division" | "company" | "default" };

export const DEFAULT_SCHEDULE: ResolvedSchedule = { name: "Jadwal perusahaan", startTime: "08:00:00", endTime: "17:00:00", graceMinutes: 15, isWorkday: true, source: "default" };

export async function resolveSchedule(executor: Executor, input: { companyId: string; department: string | null; date: string }): Promise<ResolvedSchedule> {
  const dayOfWeek = weekdayNumber(input.date);
  const columns = {
    name: workSchedules.name, baseStart: workSchedules.startTime, baseEnd: workSchedules.endTime, graceMinutes: workSchedules.graceMinutes,
    dayEnabled: workScheduleDays.enabled, dayStart: workScheduleDays.startTime, dayEnd: workScheduleDays.endTime,
  };
  const dayJoin = and(eq(workScheduleDays.scheduleId, workSchedules.id), eq(workScheduleDays.dayOfWeek, dayOfWeek));

  const [division] = input.department ? await executor.select(columns).from(divisions)
    .innerJoin(workSchedules, and(eq(workSchedules.id, divisions.scheduleId), eq(workSchedules.active, true)))
    .leftJoin(workScheduleDays, dayJoin)
    .where(and(eq(divisions.companyId, input.companyId), eq(divisions.name, input.department), eq(divisions.active, true))).limit(1) : [];
  const [company] = division ? [] : await executor.select(columns).from(workSchedules)
    .leftJoin(workScheduleDays, dayJoin)
    .where(and(eq(workSchedules.companyId, input.companyId), eq(workSchedules.active, true)))
    .orderBy(asc(workSchedules.createdAt), asc(workSchedules.id)).limit(1);

  const row = division ?? company;
  if (!row) return DEFAULT_SCHEDULE;
  return {
    name: row.name,
    startTime: row.dayStart ?? row.baseStart,
    endTime: row.dayEnd ?? row.baseEnd,
    graceMinutes: row.graceMinutes ?? 15,
    isWorkday: row.dayEnabled !== false,
    source: division ? "division" : "company",
  };
}

/** Late only on a working day of a configured schedule, and only past start time + grace. */
export function isLateCheckIn(schedule: ResolvedSchedule, time: string) {
  return schedule.isWorkday && schedule.source !== "default" && isLate(time, schedule.startTime, schedule.graceMinutes);
}

/**
 * Rules for an employee's own check-in, from the employee list's lock switches:
 * - requireLocation: "Kunci Lokasi" on and the company has an active attendance location -> must be inside a radius;
 * - requirePhoto: "Kunci Foto" on -> a camera photo must be sent.
 */
export async function selfAttendanceRules(companyId: string, employeeId: string, executor: Executor = db) {
  const [[employee], [location]] = await Promise.all([
    executor.select({ lockLocation: employees.lockLocation, lockPhoto: employees.lockPhoto }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1),
    executor.select({ id: attendanceLocations.id }).from(attendanceLocations).where(and(eq(attendanceLocations.companyId, companyId), eq(attendanceLocations.active, true))).limit(1),
  ]);
  return { requireLocation: Boolean(employee?.lockLocation && location), requirePhoto: employee?.lockPhoto ?? true };
}

export async function getSelfAttendanceStatus(context: SelfAttendanceContext) {
  const now = new Date();
  const zoned = zonedParts(now, context.timezone);
  const [[employee], [attendance], rules] = await Promise.all([
    db.select({ department: employees.department }).from(employees).where(and(eq(employees.id, context.employeeId), eq(employees.companyId, context.companyId))).limit(1),
    db.select({ id: attendances.id, checkIn: attendances.checkIn, checkOut: attendances.checkOut, status: attendances.status }).from(attendances).where(and(eq(attendances.companyId, context.companyId), eq(attendances.employeeId, context.employeeId), eq(attendances.attendanceDate, zoned.date))).limit(1),
    selfAttendanceRules(context.companyId, context.employeeId),
  ]);
  const schedule = await resolveSchedule(db, { companyId: context.companyId, department: employee?.department ?? null, date: zoned.date });
  return {
    employee: { id: context.employeeId, name: context.employeeName },
    company: { id: context.companyId, name: context.companyName, timezone: context.timezone },
    schedule,
    rules,
    attendance: attendance ?? null,
    nextAction: !attendance?.checkIn ? "check_in" : !attendance.checkOut ? "check_out" : null,
    serverTime: now.toISOString(),
  };
}

export async function recordAttendanceEvent(input: {
  actorId: string;
  companyId: string;
  employeeId: string;
  timezone: string;
  action: AttendanceAction;
  source: EventSource;
  occurredAt?: Date;
  clientCapturedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string | null;
  photo?: UploadedPhoto | null;
}) {
  const occurredAt = input.occurredAt ?? new Date();
  const zoned = zonedParts(occurredAt, input.timezone);
  try {
    return await withTransactionRetry(() => db.transaction(async (tx) => {
      const [employee] = await tx.select({ id: employees.id, userId: employees.userId, department: employees.department, lockLocation: employees.lockLocation }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, input.companyId), eq(employees.status, "active"))).limit(1);
      if (!employee) throw new AttendanceError("Karyawan aktif tidak ditemukan.", 404);
      // Kunci Lokasi off: the employee may check in outside the radius (coordinates are still recorded).
      if (input.source === "self" && employee.lockLocation) {
        const locations = await tx.select({ name: attendanceLocations.name, latitude: attendanceLocations.latitude, longitude: attendanceLocations.longitude, radiusMeters: attendanceLocations.radiusMeters }).from(attendanceLocations).where(and(eq(attendanceLocations.companyId, input.companyId), eq(attendanceLocations.active, true)));
        if (locations.length) {
          if (input.latitude == null || input.longitude == null) throw new AttendanceError("Aktifkan izin lokasi untuk melakukan presensi.", 422);
          const accuracyAllowance = Math.min(Math.max(input.accuracyMeters ?? 0, 0), 50);
          const insideLocation = locations.some((location) => distanceInMeters(input.latitude!, input.longitude!, location.latitude, location.longitude) <= location.radiusMeters + accuracyAllowance);
          if (!insideLocation) throw new AttendanceError("Anda berada di luar radius lokasi presensi yang aktif.", 422);
        }
      }
      if (input.source !== "self" && employee.userId) {
        const [targetMembership] = await tx.select({ role: companyMembers.role }).from(companyMembers).where(and(eq(companyMembers.companyId, input.companyId), eq(companyMembers.userId, employee.userId))).limit(1);
        if (targetMembership && ["admin", "owner"].includes(targetMembership.role)) {
          throw new AttendanceError("Super Admin dan Admin Perusahaan tidak memiliki presensi.", 400);
        }
      }

      // The employee's row for the day is locked, so concurrent requests for the same employee run
      // one after another while different employees never wait on each other. Duplicates are also
      // blocked by the unique indexes (employee_id, attendance_date) and (attendance_id, type).
      const lockDay = () => tx.select().from(attendances).where(and(eq(attendances.companyId, input.companyId), eq(attendances.employeeId, input.employeeId), eq(attendances.attendanceDate, zoned.date))).for("update").limit(1);
      let [attendance] = await lockDay();
      if (!attendance) {
        if (input.action === "check_out") throw new AttendanceError("Check-in harus dicatat sebelum check-out.", 409);
        [attendance] = await tx.insert(attendances).values({ companyId: input.companyId, employeeId: input.employeeId, attendanceDate: zoned.date, status: "present" }).onConflictDoNothing().returning();
        // Another request created the row first: wait for its lock, then re-read.
        if (!attendance) [attendance] = await lockDay();
      }
      if (input.action === "check_in" && attendance.checkIn) throw new AttendanceError("Check-in hari ini sudah tercatat.", 409);
      if (input.action === "check_out" && attendance.checkOut) throw new AttendanceError("Check-out hari ini sudah tercatat.", 409);
      if (input.action === "check_out" && !attendance.checkIn) throw new AttendanceError("Check-in harus dicatat sebelum check-out.", 409);

      let photoAssetId: string | null = null;
      if (input.photo) {
        const [asset] = await tx.insert(fileAssets).values({
          companyId: input.companyId,
          ownerEmployeeId: input.employeeId,
          uploadedBy: input.actorId,
          category: "attendance_photo",
          bucket: input.photo.bucket,
          objectKey: input.photo.key,
          originalName: input.photo.originalName,
          contentType: input.photo.contentType,
          byteSize: input.photo.byteSize,
          checksumSha256: input.photo.checksumSha256,
        }).returning({ id: fileAssets.id });
        photoAssetId = asset.id;
      }

      const schedule = await resolveSchedule(tx, { companyId: input.companyId, department: employee.department, date: zoned.date });
      const status = input.action === "check_in" && isLateCheckIn(schedule, zoned.time) ? "late" : attendance.status;
      await tx.insert(attendanceEvents).values({
        attendanceId: attendance.id,
        companyId: input.companyId,
        employeeId: input.employeeId,
        type: input.action,
        source: input.source,
        photoAssetId,
        occurredAt,
        clientCapturedAt: input.clientCapturedAt ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        accuracyMeters: input.accuracyMeters ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        note: input.note ?? null,
        recordedBy: input.actorId,
      });

      await tx.update(attendances).set(input.action === "check_in"
        ? { checkIn: zoned.time, status, note: input.note ?? attendance.note, updatedAt: new Date() }
        : { checkOut: zoned.time, note: input.note ?? attendance.note, updatedAt: new Date() })
        .where(eq(attendances.id, attendance.id));

      return { attendanceId: attendance.id, action: input.action, time: zoned.time, date: zoned.date, status, photoAssetId };
    }, { isolationLevel: "read committed", accessMode: "read write" }));
  } catch (error) {
    if (input.photo) await deletePrivateObject(input.photo.bucket, input.photo.key).catch(() => undefined);
    if (error instanceof AttendanceError) throw error;
    const code = pgErrorCode(error);
    if (code === "23505") throw new AttendanceError("Presensi untuk aksi ini sudah tercatat.", 409);
    if (code === "40001" || code === "40P01") throw new AttendanceError("Server sedang sibuk memproses presensi lain. Silakan coba lagi.", 503);
    throw error;
  }
}

/** Postgres SQLSTATE of a (possibly wrapped) driver error. */
function pgErrorCode(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 4; current = (current as { cause?: unknown }).cause, depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/**
 * Re-runs a transaction that Postgres aborted with a serialization failure (40001) or deadlock
 * (40P01); Postgres expects the client to retry these. Check-ins use row locks, so this is a
 * safety net rather than the normal path.
 */
export async function withTransactionRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const code = pgErrorCode(error);
      if (attempt >= attempts || (code !== "40001" && code !== "40P01")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * 2 ** attempt + Math.random() * 40));
    }
  }
}

export function requestMetadata(request: Request) {
  return {
    ipAddress: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  };
}

export { objectStorageBucket };

/**
 * Deletes one attendance day with its check-in/out events AND their photos: the file_assets rows
 * and the objects in storage (deleting the attendance alone left both behind).
 * Returns false when the attendance does not exist in this company.
 */
export async function deleteAttendanceWithPhotos(companyId: string, attendanceId: string) {
  const photos = await db.transaction(async (tx) => {
    const rows = await tx.select({ id: fileAssets.id, bucket: fileAssets.bucket, key: fileAssets.objectKey })
      .from(attendanceEvents).innerJoin(fileAssets, eq(fileAssets.id, attendanceEvents.photoAssetId))
      .where(and(eq(attendanceEvents.attendanceId, attendanceId), eq(attendanceEvents.companyId, companyId)));
    // Events cascade with the attendance; their photo assets are removed right after (FK is restrict).
    const deleted = await tx.delete(attendances).where(and(eq(attendances.id, attendanceId), eq(attendances.companyId, companyId))).returning({ id: attendances.id });
    if (!deleted.length) return null;
    if (rows.length) await tx.delete(fileAssets).where(and(eq(fileAssets.companyId, companyId), inArray(fileAssets.id, rows.map((row) => row.id))));
    return rows;
  });
  if (!photos) return false;
  // Storage is not transactional: remove objects only after the database commit.
  const results = await Promise.allSettled(photos.map((photo) => deletePrivateObject(photo.bucket, photo.key)));
  results.forEach((result, index) => { if (result.status === "rejected") console.error(`Foto presensi ${photos[index].key} gagal dihapus dari storage:`, result.reason); });
  return true;
}
