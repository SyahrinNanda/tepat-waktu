import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";

/** Menus the Admin can switch off for the whole company (Pengaturan → Pengaturan Aplikasi). */
export type AppMenuKey = "menuLaporan" | "menuKunjungan" | "menuLembur" | "menuIzin";
export type AppSettings = { greeting: string | null; quote: string | null; disabledMenus: AppMenuKey[] };

const MENU_KEYS: AppMenuKey[] = ["menuLaporan", "menuKunjungan", "menuLembur", "menuIzin"];
const MODULE_MENUS: Record<string, AppMenuKey[]> = {
  "pengajuan/izin-cuti": ["menuIzin"],
  "pengajuan/lembur": ["menuLembur"],
  kunjungan: ["menuKunjungan"],
  "kunjungan/laporan": ["menuKunjungan", "menuLaporan"],
};

export const MENU_DISABLED_MESSAGE = "Menu ini sedang dinonaktifkan oleh Admin perusahaan.";

export async function getAppSettings(companyId: string): Promise<AppSettings> {
  const [stored] = await db.select({ fields: featureRecords.fields }).from(featureRecords)
    .where(and(eq(featureRecords.companyId, companyId), eq(featureRecords.module, "pengaturan/aplikasi"))).limit(1);
  const fields = stored?.fields ?? {};
  return {
    greeting: fields.greeting?.trim() || null,
    quote: fields.quote?.trim() || null,
    disabledMenus: MENU_KEYS.filter((key) => fields[key] === "false"),
  };
}

/** The Admin keeps every menu, so a switched-off feature can still be reviewed and switched back on. */
export function menusBlockedFor(role: string, settings: AppSettings) {
  return role === "admin" || role === "owner" ? [] : settings.disabledMenus;
}

export async function moduleBlocked(companyId: string, role: string, module: string) {
  const menus = MODULE_MENUS[module];
  if (!menus || role === "admin" || role === "owner") return false;
  const { disabledMenus } = await getAppSettings(companyId);
  return menus.some((menu) => disabledMenus.includes(menu));
}

/** Page guard: leads back to Beranda when one of these menus is switched off for this role. */
export async function requireMenus(context: { companyId: string; role: string }, menus: AppMenuKey[]) {
  const blocked = menusBlockedFor(context.role, await getAppSettings(context.companyId));
  if (menus.some((menu) => blocked.includes(menu))) redirect("/dashboard");
}
