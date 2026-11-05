"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employeeDocuments, employees, fileAssets, leaveRequests, workSchedules } from "@/db/schema";
import { requireCompany, requireCompanyRole } from "@/lib/current-company";
import { deletePrivateObject, putPrivateObject } from "@/lib/object-storage";
import { compressUpload, storedFileName, type ImageProfile } from "@/lib/file-compression";
import { assertEmployeeCapacity, employeeCapacity } from "@/features/subscriptions/server/employee-capacity";

const requiredText = z.string().trim().min(1);

export async function createEmployee(form: FormData) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const parsed = z.object({
    employeeCode: z.string().trim().max(30).optional(), name: requiredText.max(120), email: z.email(),
    department: requiredText.max(80), position: requiredText.max(80), gender: z.enum(["male", "female", "unspecified"]), joinedAt: z.iso.date(),
    birthDate: z.union([z.iso.date(), z.literal("")]).optional(), phone: z.string().trim().max(40).optional(), address: z.string().trim().max(500).optional(),
    taxNumber: z.string().trim().max(60).optional(), socialSecurityNumber: z.string().trim().max(60).optional(), contractType: z.string().trim().max(60).optional(),
  }).parse(Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")));
  // Plan limit on active employees; the form page explains it and links to Langganan.
  if ((await employeeCapacity(context.companyId)).full) redirect("/dashboard/karyawan/tambah?limit=1");
  const [employee] = await db.insert(employees).values({
    ...parsed, employeeCode: parsed.employeeCode || `EMP-${randomUUID().slice(0, 8).toUpperCase()}`, email: parsed.email.toLowerCase(), companyId: context.companyId,
    birthDate: parsed.birthDate || null, phone: parsed.phone || null, address: parsed.address || null, taxNumber: parsed.taxNumber || null,
    socialSecurityNumber: parsed.socialSecurityNumber || null, contractType: parsed.contractType || null, allAttendanceLocations: form.get("allAttendanceLocations") === "on",
  }).returning({ id: employees.id });
  const stored: { bucket: string; key: string; assetId?: string }[] = [];
  try {
    const fileInputs = [["profilePhoto", "profile_photo"], ["selfiePhoto", "selfie"], ["identityCard", "identity_card"], ["certificate", "certificate"]] as const;
    for (const [field, kind] of fileInputs) {
      const file = form.get(field); if (!(file instanceof File) || file.size === 0) continue;
      if (file.size > 8 * 1024 * 1024) throw new Error(`Ukuran ${file.name} melebihi 8 MB.`);
      const sourceBytes = new Uint8Array(await file.arrayBuffer()); const format = employeeFileFormat(sourceBytes); if (!format) throw new Error(`Format ${file.name} tidak didukung.`);
      const compressed = await compressUpload(sourceBytes, format.contentType, format.extension, documentImageProfile(kind)); const bytes = compressed.bytes;
      const checksum = createHash("sha256").update(bytes).digest("hex"); const key = `companies/${context.companyId}/employees/${employee.id}/${kind}-${randomUUID()}.${compressed.extension}`;
      const object = await putPrivateObject({ key, body: bytes, contentType: compressed.contentType, storageCompression: compressed.storageCompression, metadata: { company: context.companyId, employee: employee.id, kind, sha256: checksum, uploadQuality: String(compressed.quality ?? "original") } }); stored.push(object);
      const [asset] = await db.insert(fileAssets).values({ companyId: context.companyId, ownerEmployeeId: employee.id, uploadedBy: context.session.user.id, category: "employee_document", bucket: object.bucket, objectKey: object.key, originalName: storedFileName(file.name, kind, compressed.extension), contentType: compressed.contentType, byteSize: bytes.byteLength, checksumSha256: checksum }).returning({ id: fileAssets.id });
      stored[stored.length - 1].assetId = asset.id; await db.insert(employeeDocuments).values({ employeeId: employee.id, assetId: asset.id, kind });
    }
  } catch (error) {
    for (const item of stored) { if (item.assetId) await db.delete(fileAssets).where(eq(fileAssets.id, item.assetId)).catch(() => undefined); await deletePrivateObject(item.bucket, item.key).catch(() => undefined); }
    await db.delete(employees).where(eq(employees.id, employee.id)); throw error;
  }
  revalidatePath("/dashboard/karyawan");
  revalidatePath("/dashboard");
  redirect("/dashboard/karyawan");
}

function employeeFileFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { contentType: "application/pdf", extension: "pdf" };
  return null;
}

/** Re-activating an inactive employee counts against the plan limit; already-active ones do not. */
async function reactivationAllowed(companyId: string, employeeId: string) {
  const [current] = await db.select({ status: employees.status }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!current || current.status === "active") return true;
  return !(await employeeCapacity(companyId, db, { excludeEmployeeId: employeeId })).full;
}

async function assertReactivationAllowed(companyId: string, employeeId: string) {
  if (!(await reactivationAllowed(companyId, employeeId))) await assertEmployeeCapacity(companyId, db, { excludeEmployeeId: employeeId });
}

export async function toggleEmployee(form: FormData) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const parsed = z.object({ id: z.uuid(), status: z.enum(["active", "inactive"]) }).parse(Object.fromEntries(form));
  if (parsed.status === "active") await assertReactivationAllowed(context.companyId, parsed.id);
  await db.update(employees).set({ status: parsed.status }).where(and(eq(employees.id, parsed.id), eq(employees.companyId, context.companyId)));
  revalidatePath("/dashboard/karyawan");
  revalidatePath(`/dashboard/karyawan/${parsed.id}`);
}

export async function updateEmployeeLocks(employeeId: string, locks: { location: boolean; photo: boolean; visit: boolean }) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const id = z.uuid().parse(employeeId);
  const parsed = z.object({ location: z.boolean(), photo: z.boolean(), visit: z.boolean() }).parse(locks);
  await db.update(employees).set({ lockLocation: parsed.location, lockPhoto: parsed.photo, lockVisit: parsed.visit })
    .where(and(eq(employees.id, id), eq(employees.companyId, context.companyId)));
  revalidatePath("/dashboard/karyawan");
  revalidatePath(`/dashboard/karyawan/${id}`);
}

export async function deleteEmployee(employeeId: string) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const id = z.uuid().parse(employeeId);
  const assets = await db.select({ id: fileAssets.id, bucket: fileAssets.bucket, key: fileAssets.objectKey })
    .from(fileAssets)
    .where(and(eq(fileAssets.companyId, context.companyId), eq(fileAssets.ownerEmployeeId, id)));
  const deleted = await db.delete(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, context.companyId)))
    .returning({ id: employees.id });
  if (!deleted.length) throw new Error("Karyawan tidak ditemukan.");
  if (assets.length) await db.delete(fileAssets).where(inArray(fileAssets.id, assets.map((asset) => asset.id)));
  await Promise.allSettled(assets.map((asset) => deletePrivateObject(asset.bucket, asset.key)));
  revalidatePath("/dashboard/karyawan");
}

export async function updateEmployee(form: FormData) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const parsed = z.object({
    id: z.uuid(),
    employeeCode: requiredText.max(30),
    name: requiredText.max(120),
    email: z.email(),
    department: requiredText.max(80),
    position: requiredText.max(80),
    gender: z.enum(["male", "female", "unspecified"]),
    joinedAt: z.iso.date(),
    birthDate: z.union([z.iso.date(), z.literal("")]).optional(),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(500).optional(),
    taxNumber: z.string().trim().max(60).optional(),
    socialSecurityNumber: z.string().trim().max(60).optional(),
    contractType: z.string().trim().max(60).optional(),
    status: z.enum(["active", "inactive"]),
  }).parse(Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")));
  if (parsed.status === "active" && !(await reactivationAllowed(context.companyId, parsed.id))) redirect(`/dashboard/karyawan/${parsed.id}/edit?limit=1`);
  await db.update(employees).set({
    employeeCode: parsed.employeeCode,
    name: parsed.name,
    email: parsed.email.toLowerCase(),
    department: parsed.department,
    position: parsed.position,
    gender: parsed.gender,
    joinedAt: parsed.joinedAt,
    birthDate: parsed.birthDate || null,
    phone: parsed.phone || null,
    address: parsed.address || null,
    taxNumber: parsed.taxNumber || null,
    socialSecurityNumber: parsed.socialSecurityNumber || null,
    contractType: parsed.contractType || null,
    status: parsed.status,
    allAttendanceLocations: form.get("allAttendanceLocations") === "on",
  }).where(and(eq(employees.id, parsed.id), eq(employees.companyId, context.companyId)));
  const fileInputs = [["profilePhoto", "profile_photo"], ["selfiePhoto", "selfie"], ["identityCard", "identity_card"], ["certificate", "certificate"]] as const;
  for (const [field, kind] of fileInputs) {
    const file = form.get(field); if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > 8 * 1024 * 1024) throw new Error(`Ukuran ${file.name} melebihi 8 MB.`);
    const sourceBytes = new Uint8Array(await file.arrayBuffer()); const format = employeeFileFormat(sourceBytes); if (!format) throw new Error(`Format ${file.name} tidak didukung.`);
    const compressed = await compressUpload(sourceBytes, format.contentType, format.extension, documentImageProfile(kind)); const bytes = compressed.bytes;
    const [oldDocument] = await db.select({ documentId: employeeDocuments.id, assetId: fileAssets.id, bucket: fileAssets.bucket, key: fileAssets.objectKey })
      .from(employeeDocuments).innerJoin(fileAssets, eq(employeeDocuments.assetId, fileAssets.id))
      .where(and(eq(employeeDocuments.employeeId, parsed.id), eq(employeeDocuments.kind, kind))).limit(1);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const key = `companies/${context.companyId}/employees/${parsed.id}/${kind}-${randomUUID()}.${compressed.extension}`;
    const object = await putPrivateObject({ key, body: bytes, contentType: compressed.contentType, storageCompression: compressed.storageCompression, metadata: { company: context.companyId, employee: parsed.id, kind, sha256: checksum, uploadQuality: String(compressed.quality ?? "original") } });
    const [asset] = await db.insert(fileAssets).values({ companyId: context.companyId, ownerEmployeeId: parsed.id, uploadedBy: context.session.user.id, category: "employee_document", bucket: object.bucket, objectKey: object.key, originalName: storedFileName(file.name, kind, compressed.extension), contentType: compressed.contentType, byteSize: bytes.byteLength, checksumSha256: checksum }).returning({ id: fileAssets.id });
    if (oldDocument) {
      await db.update(employeeDocuments).set({ assetId: asset.id }).where(eq(employeeDocuments.id, oldDocument.documentId));
      await db.delete(fileAssets).where(eq(fileAssets.id, oldDocument.assetId));
      await deletePrivateObject(oldDocument.bucket, oldDocument.key).catch(() => undefined);
    } else await db.insert(employeeDocuments).values({ employeeId: parsed.id, assetId: asset.id, kind });
  }
  revalidatePath("/dashboard/karyawan");
  revalidatePath(`/dashboard/karyawan/${parsed.id}`);
  redirect(`/dashboard/karyawan/${parsed.id}`);
}

export async function createSchedule(form: FormData) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const parsed = z.object({
    name: requiredText.max(80), workDays: requiredText.max(80), startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/), graceMinutes: z.coerce.number().int().min(0).max(120),
  }).parse(Object.fromEntries(form));
  await db.insert(workSchedules).values({ ...parsed, startTime: `${parsed.startTime}:00`, endTime: `${parsed.endTime}:00`, companyId: context.companyId });
  revalidatePath("/dashboard/jadwal");
}

export async function createLeaveRequest(form: FormData) {
  const context = await requireCompany();
  const parsed = z.object({
    employeeId: z.uuid(), type: z.enum(["annual", "sick", "permission"]), startDate: z.iso.date(), endDate: z.iso.date(), reason: requiredText.max(500),
  }).parse(Object.fromEntries(form));
  if (parsed.endDate < parsed.startDate) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  const canCreateForTeam = ["admin", "owner", "general_manager", "hrd"].includes(context.role);
  let employeeId = parsed.employeeId;
  if (!canCreateForTeam) {
    const [ownEmployee] = await db.select({ id: employees.id }).from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.userId, context.session.user.id))).limit(1);
    if (!ownEmployee) throw new Error("Profil karyawan untuk akun ini belum terhubung.");
    employeeId = ownEmployee.id;
  }
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) throw new Error("Karyawan tidak ditemukan.");
  await db.insert(leaveRequests).values({ ...parsed, employeeId, companyId: context.companyId });
  revalidatePath("/dashboard/pengajuan");
  revalidatePath("/dashboard/pengajuan/izin-cuti");
  revalidatePath("/dashboard");
}

export async function reviewLeave(form: FormData) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const parsed = z.object({ id: z.uuid(), status: z.enum(["approved", "rejected"]) }).parse(Object.fromEntries(form));
  await db.update(leaveRequests).set({ status: parsed.status, reviewedAt: new Date(), reviewedBy: context.session.user.id }).where(and(eq(leaveRequests.id, parsed.id), eq(leaveRequests.companyId, context.companyId)));
  revalidatePath("/dashboard/pengajuan");
  revalidatePath("/dashboard/pengajuan/izin-cuti");
  revalidatePath(`/dashboard/pengajuan/izin-cuti/${parsed.id}`);
  revalidatePath("/dashboard");
}

/** Profile and selfie photos are only viewed small; ID cards and certificates must stay legible. */
function documentImageProfile(kind: string): ImageProfile {
  return kind === "identity_card" || kind === "certificate" ? "detail" : "selfie";
}
