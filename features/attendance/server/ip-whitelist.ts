import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { ipMatchesEntry, whitelistEntryError, type WhitelistEntry } from "@/lib/client-ip";

export const IP_WHITELIST_MODULE = "pengaturan/ip-whitelist";

/** Valid entries of a company's IP whitelist (Pengaturan → IP Whitelist). Empty = no restriction. */
export async function companyIpWhitelist(companyId: string): Promise<WhitelistEntry[]> {
  const rows = await db.select({ fields: featureRecords.fields }).from(featureRecords)
    .where(and(eq(featureRecords.companyId, companyId), eq(featureRecords.module, IP_WHITELIST_MODULE), eq(featureRecords.status, "Aktif")));
  return rows.flatMap(({ fields }): WhitelistEntry[] => {
    const entry: WhitelistEntry = fields.type === "rentang"
      ? { type: "rentang", rangeFrom: fields.rangeFrom ?? "", rangeTo: fields.rangeTo ?? "" }
      : { type: "satuan_wildcard", ip: fields.ip ?? "" };
    return whitelistEntryError(entry) ? [] : [entry];
  });
}

/**
 * Null when the IP may record attendance, otherwise the message to show. A company without a
 * whitelist is unrestricted; with one, an unknown client IP is refused.
 */
export async function attendanceIpError(companyId: string, ip: string | null) {
  const entries = await companyIpWhitelist(companyId);
  if (!entries.length) return null;
  if (ip && entries.some((entry) => ipMatchesEntry(ip, entry))) return null;
  return `Presensi hanya bisa dilakukan dari jaringan kantor yang terdaftar. Alamat IP Anda saat ini${ip ? ` (${ip})` : ""} tidak ada di daftar IP Whitelist perusahaan. Hubungkan perangkat ke Wi-Fi kantor atau hubungi admin.`;
}
