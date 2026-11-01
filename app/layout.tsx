import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./refresh.css";

export const metadata: Metadata = {
  title: { default: "TepatWaktu — Kelola kehadiran tanpa ribet", template: "%s | TepatWaktu" },
  description: "Portal operasional untuk absensi, jadwal, cuti, dan laporan tim Anda.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
