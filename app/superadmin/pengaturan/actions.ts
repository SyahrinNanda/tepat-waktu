"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function savePlatformSettings(form: FormData) {
  await requireSuperAdmin();

  const data = {
    // Identitas
    platformName: String(form.get("platformName") || "TepatWaktu").trim(),
    platformTagline: String(form.get("platformTagline") || "").trim(),
    supportEmail: String(form.get("supportEmail") || "support@tepatwaktu.id").trim(),
    supportPhone: String(form.get("supportPhone") || "").trim(),
    helpdeskUrl: String(form.get("helpdeskUrl") || "").trim(),

    // Presensi Global
    defaultTimezone: String(form.get("defaultTimezone") || "Asia/Makassar").trim(),
    defaultGraceMinutes: String(form.get("defaultGraceMinutes") || "15").trim(),
    defaultGeofenceRadius: String(form.get("defaultGeofenceRadius") || "50").trim(),

    // Storage
    maxUploadSizeMb: String(form.get("maxUploadSizeMb") || "5").trim(),
    allowedFileTypes: String(form.get("allowedFileTypes") || "image/jpeg,image/png,image/webp,application/pdf").trim(),
    logRetentionDays: String(form.get("logRetentionDays") || "365").trim(),

    // Keamanan & Akses
    openRegistration: form.get("openRegistration") === "true" ? "true" : "false",
    sessionDurationDays: String(form.get("sessionDurationDays") || "7").trim(),
    maintenanceMode: form.get("maintenanceMode") === "true" ? "true" : "false",

    // Banner Pengumuman
    globalNoticeActive: form.get("globalNoticeActive") === "true" ? "true" : "false",
    globalNoticeText: String(form.get("globalNoticeText") || "").trim(),

    // Pengaturan Aplikasi (Main Feature)
    greetingText: String(form.get("greetingText") || "Hallo ✌️ $nama").trim(),
    quoteText: String(form.get("quoteText") || "Semangat Kerja ya!").trim(),
    showMenuIstirahat: form.get("showMenuIstirahat") === "true" ? "true" : "false",
    showMenuLaporan: form.get("showMenuLaporan") === "true" ? "true" : "false",
    showMenuKunjungan: form.get("showMenuKunjungan") === "true" ? "true" : "false",
    showMenuTugas: form.get("showMenuTugas") === "true" ? "true" : "false",
    showMenuLembur: form.get("showMenuLembur") === "true" ? "true" : "false",
    showMenuIzin: form.get("showMenuIzin") === "true" ? "true" : "false",
    accessVerification: form.get("accessVerification") === "true" ? "true" : "false",
  };

  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: data.defaultTimezone });
  } catch {
    throw new Error("Zona waktu tidak valid.");
  }

  for (const [key, value] of Object.entries(data)) {
    await db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  revalidatePath("/superadmin/pengaturan");
  revalidatePath("/dashboard");
}
