import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { AplikasiSettingsForm } from "./aplikasi-form";
import type { ApplicationSettingsData } from "./actions";

export const metadata: Metadata = { title: "Pengaturan Aplikasi" };

export default async function Page() {
  const context = await requireCompanyRole(["admin"]);
  const [stored] = await db
    .select({ fields: featureRecords.fields })
    .from(featureRecords)
    .where(
      and(
        eq(featureRecords.companyId, context.companyId),
        eq(featureRecords.module, "pengaturan/aplikasi"),
      ),
    )
    .limit(1);

  const fields = (stored?.fields ?? {}) as Record<string, unknown>;

  const initialSettings: ApplicationSettingsData = {
    greeting:
      typeof fields.greeting === "string"
        ? fields.greeting
        : "Hallo 👋 $nama",
    quote:
      typeof fields.quote === "string"
        ? fields.quote
        : "Semangat Kerja ya!",
    menuIstirahat:
      fields.menuIstirahat === "false" || fields.menuIstirahat === false
        ? false
        : true,
    menuLaporan:
      fields.menuLaporan === "false" || fields.menuLaporan === false
        ? false
        : true,
    menuKunjungan:
      fields.menuKunjungan === "false" || fields.menuKunjungan === false
        ? false
        : true,
    menuPayroll:
      fields.menuPayroll === "false" || fields.menuPayroll === false
        ? false
        : true,
    menuKlaimBeban:
      fields.menuKlaimBeban === "false" || fields.menuKlaimBeban === false
        ? false
        : true,
    menuTugas:
      fields.menuTugas === "false" || fields.menuTugas === false
        ? false
        : true,
    menuLembur:
      fields.menuLembur === "false" || fields.menuLembur === false
        ? false
        : true,
    menuIzin:
      fields.menuIzin === "false" || fields.menuIzin === false
        ? false
        : true,
    menuKasbon:
      fields.menuKasbon === "false" || fields.menuKasbon === false
        ? false
        : true,
    verifikasiAkses:
      fields.verifikasiAkses === "true" || fields.verifikasiAkses === true
        ? true
        : false,
  };

  return <AplikasiSettingsForm initialSettings={initialSettings} />;
}
