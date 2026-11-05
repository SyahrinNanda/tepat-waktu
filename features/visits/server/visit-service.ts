import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, fileAssets, visitAttachments, visitLocations, visits } from "@/db/schema";
import { compressUpload, storedFileName } from "@/lib/file-compression";
import { deletePrivateObject, getPrivateObject, putPrivateObject } from "@/lib/object-storage";
import type { VisitReportRow, VisitRow } from "@/features/visits/types";

/**
 * Visits a member may see: everyone's for managers, only their own for role "employee".
 * Returns null when an employee has no active employee record (they see nothing).
 */
export async function visitScope(context: { companyId: string; userId: string; role: string }): Promise<{ employeeId?: string } | null> {
  if (context.role !== "employee") return {};
  const [row] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, context.companyId), eq(employees.userId, context.userId), eq(employees.status, "active"))).limit(1);
  return row ? { employeeId: row.id } : null;
}

export async function listVisits(companyId: string, from?: string, to?: string, employeeId?: string) {
  const conditions = [eq(visits.companyId, companyId)];
  if (employeeId) conditions.push(eq(visits.employeeId, employeeId));
  if (from) conditions.push(gte(visits.visitDate, from));
  if (to) conditions.push(lte(visits.visitDate, to));
  return db.select({
    id: visits.id, employeeId: visits.employeeId, employeeName: employees.name,
    employeeCode: employees.employeeCode, locationId: visits.locationId,
    outletName: visits.outletName, visitDate: visits.visitDate, visitTime: visits.visitTime,
    latitude: visits.latitude, longitude: visits.longitude, note: visits.note, status: visits.status,
    attachmentCount: sql<number>`count(${visitAttachments.id})::int`,
  }).from(visits)
    .innerJoin(employees, eq(visits.employeeId, employees.id))
    .leftJoin(visitAttachments, eq(visits.id, visitAttachments.visitId))
    .where(and(...conditions))
    .groupBy(visits.id, employees.id)
    .orderBy(desc(visits.visitDate), desc(visits.visitTime)) as Promise<VisitRow[]>;
}

export async function createVisit(input: {
  companyId: string;
  userId: string;
  employeeId: string;
  locationId?: string;
  visitDate: string;
  visitTime: string;
  outletName?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  selfie?: File | null;
  attachments?: (File | null)[];
}) {
  const [employee] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.companyId, input.companyId),
        eq(employees.status, "active"),
      ),
    )
    .limit(1);
  if (!employee) throw new Error("Karyawan tidak ditemukan.");

  let location: typeof visitLocations.$inferSelect | undefined;
  if (input.locationId) {
    [location] = await db
      .select()
      .from(visitLocations)
      .where(
        and(
          eq(visitLocations.id, input.locationId),
          eq(visitLocations.companyId, input.companyId),
        ),
      )
      .limit(1);
  }

  const finalOutletName = input.outletName?.trim() || location?.name || "Kunjungan";
  const finalLatitude = input.latitude ?? location?.latitude ?? null;
  const finalLongitude = input.longitude ?? location?.longitude ?? null;

  const [visit] = await db
    .insert(visits)
    .values({
      companyId: input.companyId,
      employeeId: input.employeeId,
      locationId: location?.id ?? null,
      visitDate: input.visitDate,
      visitTime: input.visitTime,
      outletName: finalOutletName,
      latitude: finalLatitude,
      longitude: finalLongitude,
      note: input.note || null,
      status: "Terjadwal",
      createdBy: input.userId,
    })
    .returning();

  const stored: { bucket: string; key: string; assetId?: string }[] = [];
  try {
    // Process selfie if present (sortOrder: 0)
    if (input.selfie && input.selfie.size > 0) {
      const file = input.selfie;
      if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran foto selfie maksimal 8 MB.");
      const source = new Uint8Array(await file.arrayBuffer());
      const format = imageFormat(source);
      if (!format) throw new Error("Foto selfie harus berformat JPEG, PNG, atau WebP.");
      const compressed = await compressUpload(source, format.contentType, format.extension, "selfie");
      const checksum = createHash("sha256").update(compressed.bytes).digest("hex");
      const key = `companies/${input.companyId}/visits/${visit.id}/selfie-${randomUUID()}.${compressed.extension}`;
      const object = await putPrivateObject({
        key,
        body: compressed.bytes,
        contentType: compressed.contentType,
        storageCompression: compressed.storageCompression,
        metadata: {
          company: input.companyId,
          visit: visit.id,
          type: "selfie",
          sha256: checksum,
          uploadQuality: String(compressed.quality ?? "original"),
        },
      });
      stored.push(object);
      const [asset] = await db
        .insert(fileAssets)
        .values({
          companyId: input.companyId,
          ownerEmployeeId: input.employeeId,
          uploadedBy: input.userId,
          category: "visit_attachment",
          bucket: object.bucket,
          objectKey: object.key,
          originalName: storedFileName(file.name, "lampiran", compressed.extension),
          contentType: compressed.contentType,
          byteSize: compressed.bytes.byteLength,
          checksumSha256: checksum,
        })
        .returning({ id: fileAssets.id });
      stored.at(-1)!.assetId = asset.id;
      await db.insert(visitAttachments).values({
        visitId: visit.id,
        assetId: asset.id,
        sortOrder: 0,
      });
    }

    // Process attachments (sortOrder: 1, 2, 3)
    const validAttachments = (input.attachments || []).filter(
      (f): f is File => f instanceof File && f.size > 0,
    );
    for (const [index, file] of validAttachments.slice(0, 3).entries()) {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error(`Ukuran lampiran ${file.name} maksimal 8 MB.`);
      }
      const source = new Uint8Array(await file.arrayBuffer());
      const format = imageFormat(source);
      if (!format) {
        throw new Error(`Lampiran ${file.name} harus berformat JPEG, PNG, atau WebP.`);
      }
      const compressed = await compressUpload(source, format.contentType, format.extension, "detail");
      const checksum = createHash("sha256").update(compressed.bytes).digest("hex");
      const key = `companies/${input.companyId}/visits/${visit.id}/attachment-${index + 1}-${randomUUID()}.${compressed.extension}`;
      const object = await putPrivateObject({
        key,
        body: compressed.bytes,
        contentType: compressed.contentType,
        storageCompression: compressed.storageCompression,
        metadata: {
          company: input.companyId,
          visit: visit.id,
          slot: String(index + 1),
          sha256: checksum,
          uploadQuality: String(compressed.quality ?? "original"),
        },
      });
      stored.push(object);
      const [asset] = await db
        .insert(fileAssets)
        .values({
          companyId: input.companyId,
          ownerEmployeeId: input.employeeId,
          uploadedBy: input.userId,
          category: "visit_attachment",
          bucket: object.bucket,
          objectKey: object.key,
          originalName: storedFileName(file.name, "lampiran", compressed.extension),
          contentType: compressed.contentType,
          byteSize: compressed.bytes.byteLength,
          checksumSha256: checksum,
        })
        .returning({ id: fileAssets.id });
      stored.at(-1)!.assetId = asset.id;
      await db.insert(visitAttachments).values({
        visitId: visit.id,
        assetId: asset.id,
        sortOrder: index + 1,
      });
    }

    return visit;
  } catch (error) {
    await db.delete(visits).where(eq(visits.id, visit.id));
    for (const item of stored) {
      if (item.assetId) {
        await db.delete(fileAssets).where(eq(fileAssets.id, item.assetId)).catch(() => undefined);
      }
      await deletePrivateObject(item.bucket, item.key).catch(() => undefined);
    }
    throw error;
  }
}

function imageFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  return null;
}

export async function visitReports(companyId: string, from: string, to: string): Promise<VisitReportRow[]> {
  const rows = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      employeeCode: employees.employeeCode,
      visitId: visits.id,
      date: visits.visitDate,
      outlet: visits.outletName,
      status: visits.status,
    })
    .from(visits)
    .innerJoin(employees, eq(visits.employeeId, employees.id))
    .where(
      and(
        eq(visits.companyId, companyId),
        gte(visits.visitDate, from),
        lte(visits.visitDate, to),
      ),
    )
    .orderBy(asc(employees.name));

  const grouped = new Map<string, VisitReportRow>();
  for (const row of rows) {
    const item = grouped.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      visitCount: 0,
      completedCount: 0,
      lastVisitDate: null,
      outlets: [],
    };
    item.visitCount++;
    if (row.status === "Selesai") item.completedCount++;
    if (!item.lastVisitDate || (row.date && row.date > item.lastVisitDate)) item.lastVisitDate = row.date;
    if (row.outlet && !item.outlets.includes(row.outlet)) item.outlets.push(row.outlet);
    grouped.set(row.employeeId, item);
  }
  return [...grouped.values()];
}

export async function exportVisitWorkbook(companyId: string, from?: string, to?: string, employeeId?: string) {
  const rows = await listVisits(companyId, from, to, employeeId);
  const attachmentRows = rows.length
    ? await db
        .select({
          visitId: visitAttachments.visitId,
          assetId: fileAssets.id,
          sortOrder: visitAttachments.sortOrder,
        })
        .from(visitAttachments)
        .innerJoin(fileAssets, eq(visitAttachments.assetId, fileAssets.id))
        .where(
          and(
            eq(fileAssets.companyId, companyId),
            inArray(
              visitAttachments.visitId,
              rows.map((row) => row.id),
            ),
          ),
        )
        .orderBy(asc(visitAttachments.sortOrder))
    : [];

  const attachmentMap = new Map<string, { [key: number]: string; all: string[] }>();
  for (const item of attachmentRows) {
    const current = attachmentMap.get(item.visitId) ?? { all: [] };
    const url = `/api/files/${item.assetId}`;
    current[item.sortOrder] = url;
    current.all.push(url);
    attachmentMap.set(item.visitId, current);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TepatWaktu";
  const sheet = workbook.addWorksheet("Laporan Kunjungan", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    ["Tanggal Kunjungan", "date", 20],
    ["Karyawan", "employee", 25],
    ["Nomor Induk", "code", 16],
    ["Hari Kunjungan", "day", 18],
    ["Outlet Nama", "outlet", 26],
    ["Latitude Kunjungan", "latitude", 21],
    ["Longitude Kunjungan", "longitude", 22],
    ["Jam Berkunjung", "time", 18],
    ["Keterangan", "note", 30],
    ["Lampiran 1", "attachment1", 34],
    ["Lampiran 2", "attachment2", 34],
    ["Lampiran 3", "attachment3", 34],
  ].map(([header, key, width]) => ({ header: String(header), key: String(key), width: Number(width) }));

  const dayFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
  for (const row of rows) {
    const att = attachmentMap.get(row.id);
    const att1 = att ? att[1] || (att[0] && !att[2] && !att[3] ? att[0] : att.all[0] || "") : "";
    const att2 = att ? att[2] || (att[1] ? att.all.find((u) => u !== att1) || "" : "") : "";
    const att3 = att ? att[3] || (att[2] ? att.all.find((u) => u !== att1 && u !== att2) || "" : "") : "";

    sheet.addRow({
      date: row.visitDate,
      employee: row.employeeName,
      code: row.employeeCode,
      day: dayFormat.format(new Date(`${row.visitDate}T00:00:00Z`)),
      outlet: row.outletName,
      latitude: row.latitude ?? "",
      longitude: row.longitude ?? "",
      time: row.visitTime.slice(0, 5),
      note: row.note ?? "",
      attachment1: att1,
      attachment2: att2,
      attachment3: att3,
    });
  }

  sheet.getRow(1).font = { name: "Arial", size: 10, bold: true };
  sheet.eachRow((row, number) => {
    row.font = { name: "Arial", size: 10, bold: number === 1 };
    row.alignment = { vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer({
    useSharedStrings: true,
    useStyles: true,
    zip: { compression: "DEFLATE", compressionOptions: { level: 9 } },
  });
  return new Uint8Array(buffer);
}

export async function exportVisitPhotos(companyId: string, from?: string, to?: string, employeeId?: string) {
  const rows = await listVisits(companyId, from, to, employeeId);
  const attachments = rows.length
    ? await db
        .select({
          visitId: visitAttachments.visitId,
          sortOrder: visitAttachments.sortOrder,
          name: fileAssets.originalName,
          bucket: fileAssets.bucket,
          key: fileAssets.objectKey,
        })
        .from(visitAttachments)
        .innerJoin(fileAssets, eq(visitAttachments.assetId, fileAssets.id))
        .where(
          and(
            eq(fileAssets.companyId, companyId),
            inArray(
              visitAttachments.visitId,
              rows.map((row) => row.id),
            ),
          ),
        )
        .orderBy(asc(visitAttachments.sortOrder))
    : [];

  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const zip = new JSZip();

  for (const [index, item] of attachments.entries()) {
    const row = rowMap.get(item.visitId);
    if (!row) continue;
    const object = await getPrivateObject(item.bucket, item.key);
    const typeLabel = item.sortOrder === 0 ? "selfie" : `lampiran-${item.sortOrder}`;
    const safeName = `${row.visitDate}-${row.employeeName}-${typeLabel}-${index + 1}-${item.name}`.replace(
      /[^a-zA-Z0-9._-]+/g,
      "-",
    );
    zip.file(safeName, object.bytes);
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
