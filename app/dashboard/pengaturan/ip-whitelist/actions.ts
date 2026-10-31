"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type IpWhitelistItem = {
  id: string;
  ip: string;
  type: "satuan_wildcard" | "rentang";
  rangeFrom?: string;
  rangeTo?: string;
  createdAt: string;
  updatedAt: string;
};

const createIpWhitelistSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("satuan_wildcard"),
    ips: z.array(z.string().min(1, "IP tidak boleh kosong")).min(1, "Minimal satu IP harus diisi"),
  }),
  z.object({
    type: z.literal("rentang"),
    rangeFrom: z.string().min(1, "IP awal (Dari) wajib diisi"),
    rangeTo: z.string().min(1, "IP akhir (Sampai) wajib diisi"),
  }),
]);

function formatDate(date: Date | string | null, tz: string = "Asia/Jakarta"): string {
  if (!date) return "-";
  try {
    const d = new Date(date);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d).replace(/\./g, ":");
  } catch {
    return String(date);
  }
}

export async function fetchIpWhitelistsAction(): Promise<IpWhitelistItem[]> {
  const context = await requireCompanyRole(["admin"]);
  const tz = context.timezone || "Asia/Jakarta";

  const rows = await db
    .select({
      id: featureRecords.id,
      fields: featureRecords.fields,
      createdAt: featureRecords.createdAt,
      updatedAt: featureRecords.updatedAt,
    })
    .from(featureRecords)
    .where(
      and(
        eq(featureRecords.companyId, context.companyId),
        eq(featureRecords.module, "pengaturan/ip-whitelist"),
      ),
    )
    .orderBy(desc(featureRecords.createdAt));

  return rows.map((r) => {
    const f = (r.fields ?? {}) as Record<string, string>;
    const type = f.type === "rentang" ? "rentang" : "satuan_wildcard";
    const ip = f.ip || (type === "rentang" ? `${f.rangeFrom || ""} - ${f.rangeTo || ""}` : "-");

    return {
      id: r.id,
      ip,
      type,
      rangeFrom: f.rangeFrom,
      rangeTo: f.rangeTo,
      createdAt: formatDate(r.createdAt, tz),
      updatedAt: formatDate(r.updatedAt || r.createdAt, tz),
    };
  });
}

export async function createIpWhitelistAction(
  data: z.infer<typeof createIpWhitelistSchema>,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = createIpWhitelistSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Data tidak valid" };
    }

    if (parsed.data.type === "satuan_wildcard") {
      const validIps = parsed.data.ips
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);

      if (validIps.length === 0) {
        return { ok: false, error: "Masukkan minimal satu alamat IP." };
      }

      // Insert each IP
      for (const ip of validIps) {
        await db.insert(featureRecords).values({
          companyId: context.companyId,
          module: "pengaturan/ip-whitelist",
          fields: {
            type: "satuan_wildcard",
            ip,
          },
          status: "Aktif",
          createdBy: context.session.user.id,
        });
      }

      revalidatePath("/dashboard/pengaturan/ip-whitelist");
      return {
        ok: true,
        message: `${validIps.length} IP Whitelist berhasil ditambahkan.`,
      };
    } else {
      const rangeFrom = parsed.data.rangeFrom.trim();
      const rangeTo = parsed.data.rangeTo.trim();

      await db.insert(featureRecords).values({
        companyId: context.companyId,
        module: "pengaturan/ip-whitelist",
        fields: {
          type: "rentang",
          ip: `${rangeFrom} - ${rangeTo}`,
          rangeFrom,
          rangeTo,
        },
        status: "Aktif",
        createdBy: context.session.user.id,
      });

      revalidatePath("/dashboard/pengaturan/ip-whitelist");
      return {
        ok: true,
        message: "Rentang IP Whitelist berhasil ditambahkan.",
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
    return { ok: false, error: msg };
  }
}

export async function deleteIpWhitelistAction(input: {
  id: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);

    const [existing] = await db
      .select({ id: featureRecords.id })
      .from(featureRecords)
      .where(
        and(
          eq(featureRecords.id, input.id),
          eq(featureRecords.companyId, context.companyId),
          eq(featureRecords.module, "pengaturan/ip-whitelist"),
        ),
      )
      .limit(1);

    if (!existing) {
      return { ok: false, error: "Data IP Whitelist tidak ditemukan." };
    }

    await db
      .delete(featureRecords)
      .where(
        and(
          eq(featureRecords.id, input.id),
          eq(featureRecords.companyId, context.companyId),
        ),
      );

    revalidatePath("/dashboard/pengaturan/ip-whitelist");
    return { ok: true, message: "IP Whitelist berhasil dihapus." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
    return { ok: false, error: msg };
  }
}
