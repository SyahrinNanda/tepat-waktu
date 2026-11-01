"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type ApplicationSettingsData = {
  greeting: string;
  quote: string;
  menuIstirahat: boolean;
  menuLaporan: boolean;
  menuKunjungan: boolean;
  menuTugas: boolean;
  menuLembur: boolean;
  menuIzin: boolean;
  verifikasiAkses: boolean;
};

const settingsSchema = z.object({
  greeting: z.string().trim().max(200).default("Hallo 👋 $nama"),
  quote: z.string().trim().max(300).default("Semangat Kerja ya!"),
  menuIstirahat: z.boolean().default(true),
  menuLaporan: z.boolean().default(true),
  menuKunjungan: z.boolean().default(true),
  menuTugas: z.boolean().default(true),
  menuLembur: z.boolean().default(true),
  menuIzin: z.boolean().default(true),
  verifikasiAkses: z.boolean().default(false),
});

export async function saveApplicationSettings(
  input: ApplicationSettingsData,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = settingsSchema.parse(input);

    const fields: Record<string, string> = {
      greeting: parsed.greeting,
      quote: parsed.quote,
      menuIstirahat: String(parsed.menuIstirahat),
      menuLaporan: String(parsed.menuLaporan),
      menuKunjungan: String(parsed.menuKunjungan),
      menuTugas: String(parsed.menuTugas),
      menuLembur: String(parsed.menuLembur),
      menuIzin: String(parsed.menuIzin),
      verifikasiAkses: String(parsed.verifikasiAkses),
    };

    const [existing] = await db
      .select({ id: featureRecords.id })
      .from(featureRecords)
      .where(
        and(
          eq(featureRecords.companyId, context.companyId),
          eq(featureRecords.module, "pengaturan/aplikasi"),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(featureRecords)
        .set({
          fields,
          updatedBy: context.session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(featureRecords.id, existing.id));
    } else {
      await db.insert(featureRecords).values({
        companyId: context.companyId,
        module: "pengaturan/aplikasi",
        fields,
        createdBy: context.session.user.id,
      });
    }

    revalidatePath("/dashboard/pengaturan/aplikasi");
    revalidatePath("/dashboard");
    return { ok: true, message: "Pengaturan aplikasi berhasil disimpan." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan aplikasi.";
    return { ok: false, error: message };
  }
}
