"use client";

import { Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  saveApplicationSettings,
  type ApplicationSettingsData,
} from "./actions";

export function AplikasiSettingsForm({
  initialSettings,
}: {
  initialSettings: ApplicationSettingsData;
}) {
  const [form, setForm] = useState<ApplicationSettingsData>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const toggleField = (field: keyof ApplicationSettingsData) => {
    setForm((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await saveApplicationSettings(form);
      if (res.ok) {
        setFeedback({
          type: "success",
          message: res.message || "Pengaturan aplikasi berhasil disimpan.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal menyimpan pengaturan aplikasi.",
        });
      }
    });
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "48px" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "12.5px",
            color: "#787673",
            marginBottom: "4px",
            fontWeight: 500,
          }}
        >
          Kehadiran Admin Panel
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#181615",
            letterSpacing: "0.02em",
            margin: "0 0 6px 0",
          }}
        >
          PENGATURAN APLIKASI
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "#5a5854",
          }}
        >
          <Link
            href="/dashboard"
            style={{ color: "#787673", textDecoration: "none" }}
          >
            Beranda
          </Link>
          <span style={{ color: "#a8a6a3" }}>/</span>
          <span style={{ color: "#474541", fontWeight: 500 }}>
            Pengaturan Aplikasi
          </span>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "18px",
            fontSize: "14px",
            fontWeight: 500,
            backgroundColor: feedback.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: feedback.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${feedback.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Main Settings Card */}
      <form
        onSubmit={handleSave}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e9e8e7",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          padding: "28px 32px",
        }}
      >
        {/* Section 1: Pengaturan Kata Kata Sapaan */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#262421",
              margin: "0 0 16px 0",
            }}
          >
            Pengaturan Kata Kata Sapaan
          </h2>

          {/* Info Banner */}
          <div
            style={{
              backgroundColor: "#fff5e0",
              borderRadius: "6px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
              fontSize: "13px",
              color: "#9d5207",
            }}
          >
            <Info size={18} style={{ color: "#b05c07", flexShrink: 0 }} />
            <span>
              Anda dapat menambahkan <strong>$nama</strong> untuk menampilkan nama
              lengkap karyawan
            </span>
          </div>

          {/* Kalimat Sapaan */}
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="greeting-input"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#474541",
                marginBottom: "6px",
              }}
            >
              Kalimat Sapaan
            </label>
            <input
              id="greeting-input"
              type="text"
              value={form.greeting}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, greeting: e.target.value }))
              }
              placeholder="Hallo 👋 $nama"
              style={{
                width: "100%",
                height: "42px",
                padding: "8px 14px",
                fontSize: "14px",
                color: "#242220",
                border: "1px solid #d9d6d3",
                borderRadius: "6px",
                outline: "none",
                backgroundColor: "#ffffff",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#faa005")}
              onBlur={(e) => (e.target.style.borderColor = "#d9d6d3")}
            />
          </div>

          {/* Kalimat Kutipan */}
          <div>
            <label
              htmlFor="quote-input"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#474541",
                marginBottom: "6px",
              }}
            >
              Kalimat Kutipan
            </label>
            <input
              id="quote-input"
              type="text"
              value={form.quote}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, quote: e.target.value }))
              }
              placeholder="Ayo Kerja Optimal 😂"
              style={{
                width: "100%",
                height: "42px",
                padding: "8px 14px",
                fontSize: "14px",
                color: "#242220",
                border: "1px solid #d9d6d3",
                borderRadius: "6px",
                outline: "none",
                backgroundColor: "#ffffff",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#faa005")}
              onBlur={(e) => (e.target.style.borderColor = "#d9d6d3")}
            />
          </div>
        </div>

        {/* Section 2: Pengaturan Menu Halaman Depan */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#262421",
              margin: "0 0 18px 0",
            }}
          >
            Pengaturan Menu Halaman Depan
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              maxWidth: "450px",
            }}
          >
            {[
              { key: "menuIstirahat", label: "Tampilkan Menu Istirahat" },
              { key: "menuLaporan", label: "Tampilkan Menu Laporan" },
              { key: "menuKunjungan", label: "Tampilkan Menu Kunjungan" },
              { key: "menuTugas", label: "Tampilkan Menu Tugas" },
              { key: "menuLembur", label: "Tampilkan Menu Lembur" },
              { key: "menuIzin", label: "Tampilkan Menu Izin" },
            ].map((item) => {
              const active = form[item.key as keyof ApplicationSettingsData] as boolean;
              return (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13.5px",
                      color: "#474541",
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    onClick={() =>
                      toggleField(item.key as keyof ApplicationSettingsData)
                    }
                    style={{
                      position: "relative",
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      backgroundColor: active ? "#faa005" : "#ef4444",
                      transition: "background-color 0.2s ease",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      display: "inline-flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {active && (
                      <svg
                        style={{
                          position: "absolute",
                          left: "6px",
                          width: "11px",
                          height: "11px",
                          color: "#ffffff",
                        }}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span
                      style={{
                        width: "19px",
                        height: "19px",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        transform: active
                          ? "translateX(21px)"
                          : "translateX(1px)",
                        transition:
                          "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "inline-block",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Pengaturan Verifikasi Akses */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#262421",
              margin: "0 0 18px 0",
            }}
          >
            Pengaturan Verifikasi Akses
          </h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: "450px",
            }}
          >
            <span
              style={{
                fontSize: "13.5px",
                color: "#474541",
                fontWeight: 500,
              }}
            >
              Aktifkan Verifikasi Akses
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.verifikasiAkses}
              onClick={() => toggleField("verifikasiAkses")}
              style={{
                position: "relative",
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                backgroundColor: form.verifikasiAkses ? "#faa005" : "#ef4444",
                transition: "background-color 0.2s ease",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {form.verifikasiAkses && (
                <svg
                  style={{
                    position: "absolute",
                    left: "6px",
                    width: "11px",
                    height: "11px",
                    color: "#ffffff",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span
                style={{
                  width: "19px",
                  height: "19px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transform: form.verifikasiAkses
                    ? "translateX(21px)"
                    : "translateX(1px)",
                  transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "inline-block",
                }}
              />
            </button>
          </div>
        </div>

        {/* Footer with SIMPAN button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid #f6f5f4",
            paddingTop: "20px",
          }}
        >
          <button
            type="submit"
            disabled={isPending}
            style={{
              backgroundColor: "#faa005",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "10px 28px",
              borderRadius: "6px",
              border: "none",
              cursor: isPending ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => {
              if (!isPending) e.currentTarget.style.backgroundColor = "#e79405";
            }}
            onMouseOut={(e) => {
              if (!isPending) e.currentTarget.style.backgroundColor = "#faa005";
            }}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            SIMPAN
          </button>
        </div>
      </form>
    </div>
  );
}
