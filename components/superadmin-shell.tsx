"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Megaphone, ScrollText, TicketPercent, AlarmClock, BarChart3, Filter, Bell, Building2, CreditCard, ExternalLink, LayoutDashboard, LogOut, Menu, MessageCircle, Settings, Tags, Users, Video, X, UserX } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Logo } from "./logo";
import { FloatingMenuLayer } from "./floating-menu-layer";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const items: NavItem[] = [
  { href: "/superadmin", label: "Beranda", icon: LayoutDashboard },
  { href: "/superadmin/users", label: "Kelola Seluruh Akun", icon: Users },
  { href: "/superadmin/penghapusan-akun", label: "Permintaan Hapus Akun", icon: UserX },
  { href: "/superadmin/perusahaan", label: "Semua Perusahaan", icon: Building2 },
  { href: "/superadmin/langganan", label: "Semua Langganan", icon: CreditCard },
  { href: "/superadmin/retensi", label: "Retensi Pelanggan", icon: AlarmClock },
  { href: "/superadmin/pendapatan", label: "Laporan Pendapatan", icon: BarChart3 },
  { href: "/superadmin/konversi", label: "Konversi Trial", icon: Filter },
  { href: "/superadmin/paket", label: "Paket & Harga", icon: Tags },
  { href: "/superadmin/kupon", label: "Kupon Diskon", icon: TicketPercent },
  { href: "/superadmin/pengumuman", label: "Pengumuman Platform", icon: Megaphone },
  { href: "/superadmin/log", label: "Log Aktivitas", icon: ScrollText },
  { href: "/superadmin/pengaturan", label: "Pengaturan Platform", icon: Settings },
];

export function SuperAdminShell({
  children,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = userName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function logout() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/superadmin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="app-shell">
      {open ? <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Tutup navigasi" /> : null}
      <FloatingMenuLayer />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand-row">
          <Logo href={"/superadmin" as Route} />
          <button className="icon-button mobile-menu" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
        </div>

        <nav className="nav-scroll" aria-label="Navigasi super admin">
          <div className="nav-list">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  className={`nav-item ${active ? "active" : ""}`}
                  href={item.href as Route}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={17} strokeWidth={1.9} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Menu size={21} />
            </button>
            <div className="topbar-company">
              <small>Kehadiran Super Admin Panel</small>
              <strong>TepatWaktu Platform Console</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="support-link"
              title="Tutorial Youtube"
            >
              <Video size={14} style={{ color: "#ef4444" }} /> Tutorial Youtube <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </a>
            <a
              href="https://wa.me"
              target="_blank"
              rel="noreferrer"
              className="support-link"
              title="Customer Service"
            >
              <MessageCircle size={14} style={{ color: "#22c55e" }} /> Customer Service <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </a>
            <button className="icon-button notification-button" aria-label="Notifikasi">
              <Bell size={19} />
              <i />
            </button>
            <span className="role-pill superadmin-role">Super Admin</span>
            <div className="topbar-user" title={userEmail}>
              <span className="avatar">
                {initials || "SA"}
              </span>
              <span>
                <strong>{userName}</strong>
                <small>{userEmail}</small>
              </span>
            </div>
            <button className="icon-button" onClick={logout} title="Keluar" aria-label="Keluar">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
