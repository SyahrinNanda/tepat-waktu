"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  HardDrive,
  Info,
  LoaderCircle,
  Save,
  Shield,
  Smartphone,
} from "lucide-react";
import { savePlatformSettings } from "./actions";

type SettingsMap = Record<string, string>;

export function PlatformSettingsForm({ initialSettings }: { initialSettings: SettingsMap }) {
  const [activeTab, setActiveTab] = useState<
    "mobile" | "general" | "attendance" | "storage" | "security" | "broadcast"
  >("mobile");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [settings, setSettings] = useState<SettingsMap>(initialSettings);

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleToggle(key: string) {
    setSettings((prev) => {
      const current = prev[key] === "true";
      return { ...prev, [key]: current ? "false" : "true" };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    const formData = new FormData();
    for (const [key, value] of Object.entries(settings)) {
      formData.set(key, value);
    }

    try {
      await savePlatformSettings(formData);
      setNotice({ type: "success", text: "Pengaturan platform berhasil disimpan dan diperbarui." });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal menyimpan pengaturan." });
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: "mobile", label: "Pengaturan Aplikasi", icon: Smartphone },
    { id: "general", label: "Profil & Kontak", icon: Building2 },
    { id: "attendance", label: "Presensi Global", icon: Clock },
    { id: "storage", label: "Storage & Media", icon: HardDrive },
    { id: "security", label: "Keamanan & Sesi", icon: Shield },
    { id: "broadcast", label: "Pengumuman Sistem", icon: Bell },
  ] as const;

  return (
    <form onSubmit={handleSubmit}>
      {/* Horizontal Navigation Tabs */}
      <nav className="settings-nav-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              className={`settings-nav-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Settings Body */}
      <div className="settings-form-body">
        {notice ? (
          <div
            className={notice.type === "success" ? "success-box" : "error-box"}
            role="alert"
            style={{ marginBottom: "24px" }}
          >
            {notice.type === "success" ? <CheckCircle2 size={16} /> : null}
            {notice.text}
          </div>
        ) : null}

        {/* TAB 1: PENGATURAN APLIKASI (MATCHING SCREENSHOT 2026-10-16 112545.png) */}
        {activeTab === "mobile" && (
          <div>
            <div className="settings-section-head">
              <h3>Pengaturan Kata Kata Sapaan</h3>
            </div>

            <div className="info-alert-box">
              <Info size={17} style={{ flexShrink: 0 }} />
              <span>
                Anda dapat menambahkan <strong>$nama</strong> untuk menampilkan nama lengkap karyawan.
              </span>
            </div>

            <div className="form-grid" style={{ marginBottom: "32px" }}>
              <label className="field full">
                <span className="field-label">Kalimat Sapaan</span>
                <input
                  className="input"
                  name="greetingText"
                  value={settings.greetingText ?? "Hallo ✌️ $nama"}
                  onChange={(e) => handleChange("greetingText", e.target.value)}
                  placeholder="Contoh: Hallo ✌️ $nama"
                />
              </label>

              <label className="field full">
                <span className="field-label">Kalimat Kutipan</span>
                <input
                  className="input"
                  name="quoteText"
                  value={settings.quoteText ?? "Semangat Kerja ya!"}
                  onChange={(e) => handleChange("quoteText", e.target.value)}
                  placeholder="Contoh: Semangat Kerja ya!"
                />
              </label>
            </div>

            <div className="settings-section-head" style={{ marginTop: "28px" }}>
              <h3>Pengaturan Menu Halaman Depan</h3>
              <p>Aktifkan atau sembunyikan modul akses cepat pada beranda aplikasi mobile / karyawan.</p>
            </div>

            <div style={{ maxWidth: "680px", marginBottom: "32px" }}>
              {[
                { key: "showMenuIstirahat", label: "Tampilkan Menu Istirahat", defaultVal: "true" },
                { key: "showMenuLaporan", label: "Tampilkan Menu Laporan", defaultVal: "true" },
                { key: "showMenuKunjungan", label: "Tampilkan Menu Kunjungan", defaultVal: "true" },
                { key: "showMenuTugas", label: "Tampilkan Menu Tugas", defaultVal: "true" },
                { key: "showMenuLembur", label: "Tampilkan Menu Lembur", defaultVal: "true" },
                { key: "showMenuIzin", label: "Tampilkan Menu Izin", defaultVal: "true" },
              ].map((item) => {
                const checked = (settings[item.key] ?? item.defaultVal) === "true";
                return (
                  <div key={item.key} className="settings-toggle-row">
                    <span className="settings-toggle-label">{item.label}</span>
                    <label className="ui-switch">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(item.key)}
                      />
                      <span className="ui-switch-slider" />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="settings-section-head" style={{ marginTop: "28px" }}>
              <h3>Pengaturan Verifikasi Akses</h3>
            </div>

            <div style={{ maxWidth: "680px" }}>
              <div className="settings-toggle-row">
                <span className="settings-toggle-label">Aktifkan Verifikasi Akses</span>
                <label className="ui-switch">
                  <input
                    type="checkbox"
                    checked={(settings.accessVerification ?? "false") === "true"}
                    onChange={() => handleToggle("accessVerification")}
                  />
                  <span className="ui-switch-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROFIL & KONTAK */}
        {activeTab === "general" && (
          <div>
            <div className="settings-section-head">
              <h3>Profil & Saluran Dukungan Resmi</h3>
              <p>Identitas platform dan kontak bantuan resmi untuk seluruh tenant.</p>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Nama Platform</span>
                <input
                  className="input"
                  name="platformName"
                  value={settings.platformName ?? "TepatWaktu"}
                  onChange={(e) => handleChange("platformName", e.target.value)}
                  required
                />
                <small style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Ditampilkan pada header, tab browser, dan email sistem.
                </small>
              </label>

              <label className="field">
                <span className="field-label">Tagline / Slogan Platform</span>
                <input
                  className="input"
                  name="platformTagline"
                  value={settings.platformTagline ?? "Sistem Manajemen Kehadiran & HR Terintegrasi"}
                  onChange={(e) => handleChange("platformTagline", e.target.value)}
                  placeholder="Contoh: Portal Presensi Karyawan Multi-Tenant Terpercaya"
                />
              </label>

              <label className="field">
                <span className="field-label">Email Dukungan Resmi (Support)</span>
                <input
                  className="input"
                  name="supportEmail"
                  type="email"
                  value={settings.supportEmail ?? "support@tepatwaktu.id"}
                  onChange={(e) => handleChange("supportEmail", e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Hotline WhatsApp / Telepon</span>
                <input
                  className="input"
                  name="supportPhone"
                  value={settings.supportPhone ?? "+62 812-4000-8800"}
                  onChange={(e) => handleChange("supportPhone", e.target.value)}
                  placeholder="Contoh: +62 812-3456-7890"
                />
              </label>

              <label className="field full">
                <span className="field-label">URL Portal Bantuan / Panduan Pengguna</span>
                <input
                  className="input"
                  name="helpdeskUrl"
                  value={settings.helpdeskUrl ?? "https://bantuan.tepatwaktu.id"}
                  onChange={(e) => handleChange("helpdeskUrl", e.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>
        )}

        {/* TAB 3: PRESENSI GLOBAL */}
        {activeTab === "attendance" && (
          <div>
            <div className="settings-section-head">
              <h3>Parameter Presensi Global</h3>
              <p>Pengaturan zona waktu default, toleransi waktu, dan batas radius geofencing kantor.</p>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Zona Waktu Default Platform</span>
                <select
                  className="input"
                  name="defaultTimezone"
                  value={settings.defaultTimezone ?? "Asia/Makassar"}
                  onChange={(e) => handleChange("defaultTimezone", e.target.value)}
                >
                  <option value="Asia/Jakarta">WIB (Asia/Jakarta - UTC+7)</option>
                  <option value="Asia/Makassar">WITA (Asia/Makassar - UTC+8)</option>
                  <option value="Asia/Jayapura">WIT (Asia/Jayapura - UTC+9)</option>
                </select>
                <small style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Zona waktu acuan default saat perusahaan baru mendaftar.
                </small>
              </label>

              <label className="field">
                <span className="field-label">Toleransi Keterlambatan Default (Menit)</span>
                <input
                  className="input"
                  name="defaultGraceMinutes"
                  type="number"
                  min="0"
                  max="120"
                  value={settings.defaultGraceMinutes ?? "15"}
                  onChange={(e) => handleChange("defaultGraceMinutes", e.target.value)}
                  required
                />
              </label>

              <label className="field full">
                <span className="field-label">Batas Toleransi Radius Geofencing (Meter)</span>
                <input
                  className="input"
                  name="defaultGeofenceRadius"
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.defaultGeofenceRadius ?? "50"}
                  onChange={(e) => handleChange("defaultGeofenceRadius", e.target.value)}
                  required
                />
                <small style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Radius toleransi jarak GPS dari titik koordinat kantor pada saat presensi.
                </small>
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: STORAGE & MEDIA */}
        {activeTab === "storage" && (
          <div>
            <div className="settings-section-head">
              <h3>Penyimpanan Berkas & Media</h3>
              <p>Aturan kuota upload foto selfie presensi, bukti lampiran, dan retensi data log.</p>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Ukuran Maksimal Upload Foto Presensi (MB)</span>
                <input
                  className="input"
                  name="maxUploadSizeMb"
                  type="number"
                  min="1"
                  max="25"
                  value={settings.maxUploadSizeMb ?? "5"}
                  onChange={(e) => handleChange("maxUploadSizeMb", e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Retensi Log Audit Sistem (Hari)</span>
                <input
                  className="input"
                  name="logRetentionDays"
                  type="number"
                  min="30"
                  max="1825"
                  value={settings.logRetentionDays ?? "365"}
                  onChange={(e) => handleChange("logRetentionDays", e.target.value)}
                  required
                />
              </label>

              <label className="field full">
                <span className="field-label">Format Berkas yang Diizinkan (MIME Types)</span>
                <input
                  className="input"
                  name="allowedFileTypes"
                  value={settings.allowedFileTypes ?? "image/jpeg,image/png,image/webp,application/pdf"}
                  onChange={(e) => handleChange("allowedFileTypes", e.target.value)}
                  required
                />
              </label>
            </div>
          </div>
        )}

        {/* TAB 5: KEAMANAN & SESI */}
        {activeTab === "security" && (
          <div>
            <div className="settings-section-head">
              <h3>Keamanan & Kontrol Sesi</h3>
              <p>Kelola pendaftaran mandiri, batas waktu sesi aktif, dan mode pemeliharaan platform.</p>
            </div>

            <div className="form-grid" style={{ marginBottom: "24px" }}>
              <label className="field">
                <span className="field-label">Masa Berlaku Sesi Login (Hari)</span>
                <input
                  className="input"
                  name="sessionDurationDays"
                  type="number"
                  min="1"
                  max="90"
                  value={settings.sessionDurationDays ?? "7"}
                  onChange={(e) => handleChange("sessionDurationDays", e.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ maxWidth: "680px" }}>
              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Pendaftaran Akun Terbuka (Public Sign-up)</div>
                  <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                    Jika dinonaktifkan, akun hanya bisa dibuat melalui undangan Super Admin atau Admin Perusahaan.
                  </small>
                </div>
                <label className="ui-switch">
                  <input
                    type="checkbox"
                    checked={(settings.openRegistration ?? "true") === "true"}
                    onChange={() => handleToggle("openRegistration")}
                  />
                  <span className="ui-switch-slider" />
                </label>
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label" style={{ color: "#b91c1c" }}>
                    Mode Pemeliharaan (Maintenance Mode)
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                    Jika aktif, hanya Super Admin yang dapat mengakses sistem.
                  </small>
                </div>
                <label className="ui-switch">
                  <input
                    type="checkbox"
                    checked={(settings.maintenanceMode ?? "false") === "true"}
                    onChange={() => handleToggle("maintenanceMode")}
                  />
                  <span className="ui-switch-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PENGUMUMAN SISTEM */}
        {activeTab === "broadcast" && (
          <div>
            <div className="settings-section-head">
              <h3>Siaran Pengumuman Global</h3>
              <p>Tampilkan banner pengumuman di bagian atas dashboard seluruh pengguna platform.</p>
            </div>

            <div style={{ maxWidth: "680px", marginBottom: "20px" }}>
              <div className="settings-toggle-row">
                <span className="settings-toggle-label">Aktifkan Banner Pengumuman</span>
                <label className="ui-switch">
                  <input
                    type="checkbox"
                    checked={(settings.globalNoticeActive ?? "false") === "true"}
                    onChange={() => handleToggle("globalNoticeActive")}
                  />
                  <span className="ui-switch-slider" />
                </label>
              </div>
            </div>

            <label className="field full">
              <span className="field-label">Teks Pengumuman Sistem</span>
              <textarea
                className="input"
                name="globalNoticeText"
                rows={4}
                style={{ height: "auto", padding: "12px 14px" }}
                value={settings.globalNoticeText ?? ""}
                onChange={(e) => handleChange("globalNoticeText", e.target.value)}
                placeholder="Contoh: Pemeliharaan server terjadwal pada hari Minggu pukul 01:00 - 04:00 WITA. Layanan presensi tetap dapat mencatat secara offline."
              />
            </label>
          </div>
        )}

        {/* Action Button Footer matching Main Feature */}
        <div className="settings-actions-footer">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ minWidth: "140px", height: "42px", fontWeight: 700 }}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            {loading ? "Menyimpan..." : "SIMPAN"}
          </button>
        </div>
      </div>
    </form>
  );
}
