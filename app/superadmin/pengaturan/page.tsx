import type { Metadata } from "next";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { PlatformSettingsForm } from "./platform-settings-form";

export const metadata: Metadata = { title: "Pengaturan Platform" };

export default async function Page() {
  await requireSuperAdmin();

  const settingsRows = await db.select().from(platformSettings);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

  return (
    <>
      <header className="product-page-header">
        <div>
          <span className="breadcrumb">Presensi Super Admin Panel</span>
          <h1>PENGATURAN PLATFORM</h1>
          <p>
            Konfigurasi global ekosistem TepatWaktu. Nilai ini menjadi parameter default untuk seluruh tenant dan integrasi sistem.
          </p>
        </div>
      </header>

      <section className="module-card">
        <PlatformSettingsForm initialSettings={settings} />
      </section>
    </>
  );
}
