"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  MessageCircleQuestion,
  PackageSearch,
  Settings,
  Users,
  WalletCards,
  X,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { PlatformAnnouncements } from "@/features/platform-admin/components/platform-announcements";
import type { TenantAnnouncement } from "@/features/platform-admin/server/announcements";
import { SubscriptionBanner, SubscriptionBell, SubscriptionWarningDialog, type SubscriptionAlertInput } from "@/features/subscriptions/components/subscription-alerts";
import { leaveCompany } from "@/app/superadmin/actions";
import { Logo } from "./logo";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  roles?: CompanyRole[];
};

type CompanyRole = "admin" | "general_manager" | "hrd" | "manager" | "employee";
const managementRoles: CompanyRole[] = ["admin", "general_manager", "hrd", "manager"];
const hrRoles: CompanyRole[] = ["admin", "general_manager", "hrd"];

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  base: string;
  children: NavItem[];
};

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { href: "/dashboard/pengumuman", label: "Pemberitahuan", icon: Megaphone },
];

const groups: NavGroup[] = [
  {
    label: "Master Data",
    icon: PackageSearch,
    base: "/dashboard/master",
    children: [
      { href: "/dashboard/master/shift", label: "Jadwal Kerja", roles: hrRoles },
      { href: "/dashboard/master/jam-kerja", label: "Hari dan Waktu Kerja", roles: hrRoles },
      { href: "/dashboard/master/divisi", label: "Divisi", roles: hrRoles },
      { href: "/dashboard/master/jabatan", label: "Jabatan", roles: hrRoles },
      { href: "/dashboard/master/lokasi-presensi", label: "Lokasi Kerja", roles: hrRoles },
    ],
  },
  {
    label: "Karyawan",
    icon: Users,
    base: "/dashboard/karyawan",
    children: [
      { href: "/dashboard/karyawan", label: "Daftar Karyawan", roles: managementRoles },
      { href: "/dashboard/karyawan/gaji", label: "Daftar Gaji Karyawan", roles: hrRoles },
      { href: "/dashboard/karyawan/slip-gaji", label: "Slip Gaji", roles: hrRoles },
      { href: "/dashboard/karyawan/laporan-cuti", label: "Laporan Cuti", roles: managementRoles },
      { href: "/dashboard/karyawan/keluhan", label: "Keluhan Karyawan" },
    ],
  },
  {
    label: "Pengajuan Karyawan",
    icon: ClipboardList,
    base: "/dashboard/pengajuan",
    children: [
      { href: "/dashboard/pengajuan/izin-cuti", label: "Izin / Cuti" },
      { href: "/dashboard/pengajuan/lembur", label: "Lembur" },
    ],
  },
  {
    label: "Kehadiran",
    icon: CalendarCheck2,
    base: "/dashboard/presensi",
    children: [
      { href: "/dashboard/presensi/check-in", label: "Check-in / Check-out", roles: ["general_manager", "hrd", "manager", "employee"] },
      { href: "/dashboard/presensi/riwayat", label: "Riwayat", roles: ["admin", "general_manager", "hrd", "manager", "employee"] },
      { href: "/dashboard/presensi/harian", label: "Kehadiran", roles: managementRoles },
      { href: "/dashboard/presensi/bulanan", label: "Laporan Bulanan", roles: managementRoles },
    ],
  },
  {
    label: "Kunjungan",
    icon: MapPinned,
    base: "/dashboard/kunjungan",
    children: [
      { href: "/dashboard/kunjungan", label: "Daftar Kunjungan" },
      { href: "/dashboard/kunjungan/laporan", label: "Laporan Kunjungan" },
    ],
  },
  {
    label: "Pengaturan",
    icon: Settings,
    base: "/dashboard/pengaturan",
    children: [
      { href: "/dashboard/pengaturan/profile", label: "Profile" },
      { href: "/dashboard/pengaturan/aplikasi", label: "Pengaturan Aplikasi", roles: ["admin"] },
      { href: "/dashboard/pengaturan/users", label: "User Login", roles: ["admin"] },
      { href: "/dashboard/pengaturan/roles", label: "User Level", roles: ["admin"] },
    ],
  },
];

const secondaryItems: NavItem[] = [
  { href: "/dashboard/langganan", label: "Langganan", icon: WalletCards, roles: ["admin"] },
];

export function DashboardShell({
  children,
  userName,
  userEmail,
  companyName,
  role,
  isSuperAdmin = false,
  subscription,
  announcements = [],
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  companyName: string;
  role: string;
  isSuperAdmin?: boolean;
  subscription?: SubscriptionAlertInput;
  announcements?: TenantAnnouncement[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const normalizedRole = (role === "owner" ? "admin" : role) as CompanyRole;
  const canRenew = isSuperAdmin || normalizedRole === "admin";
  const canAccess = (item: NavItem) => !item.roles || item.roles.includes(normalizedRole);
  const roleLabels: Record<CompanyRole, string> = {
    admin: "Admin Perusahaan",
    general_manager: "General Manager",
    hrd: "HRD",
    manager: "Manager",
    employee: "Karyawan / Staf",
  };
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
    if (["/dashboard", "/dashboard/karyawan", "/dashboard/kunjungan"].includes(href)) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="app-shell">
      {open ? <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Tutup navigasi" /> : null}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand-row">
          <Logo href="/dashboard" />
          <button className="icon-button mobile-menu" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
        </div>

        <nav className="nav-scroll" aria-label="Navigasi utama">
          <div className="nav-list">
            {primaryItems.filter(canAccess).map((item) => (
              <NavLink item={item} active={isActive(item.href)} onClick={() => setOpen(false)} key={item.href} />
            ))}
          </div>

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = pathname.startsWith(group.base);
            const visibleChildren = group.children.filter(canAccess);
            if (!visibleChildren.length) return null;
            return (
              <details className={`nav-group ${groupActive ? "active" : ""}`} open={groupActive} key={group.label}>
                <summary>
                  <span className="nav-group-label"><GroupIcon size={17} strokeWidth={1.9} />{group.label}</span>
                  <ChevronDown className="nav-chevron" size={15} />
                </summary>
                <div className="nav-children">
                  {visibleChildren.map((item) => (
                    <Link
                      className={`nav-child ${isActive(item.href) ? "active" : ""}`}
                      href={item.href as Route}
                      key={item.href}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}

          <div className="nav-list nav-secondary">
            {secondaryItems.filter(canAccess).map((item) => (
              <NavLink item={item} active={isActive(item.href)} onClick={() => setOpen(false)} key={item.href} />
            ))}
          </div>
          {isSuperAdmin ? (
            <div className="nav-list nav-secondary superadmin-dashboard-links">
              <span className="nav-section-label">NAVIGASI SUPERADMIN</span>
              <form action={leaveCompany} style={{ marginBottom: "6px" }}>
                <button type="submit" className="btn btn-sm btn-outline btn-block" style={{ color: "#c83d49", borderColor: "#ffd4d8", background: "#fff5f6" }}>
                  <ArrowLeft size={14} /> Keluar ke Super Admin
                </button>
              </form>
              <NavLink item={{ href: "/superadmin", label: "Pilih Perusahaan", icon: Building2 }} active={false} onClick={() => setOpen(false)} />
              <NavLink item={{ href: "/superadmin/users", label: "Kelola Seluruh Akun", icon: Users }} active={false} onClick={() => setOpen(false)} />
              <NavLink item={{ href: "/superadmin/langganan", label: "Semua Langganan", icon: WalletCards }} active={false} onClick={() => setOpen(false)} />
              <NavLink item={{ href: "/superadmin/paket", label: "Paket & Harga", icon: Settings }} active={false} onClick={() => setOpen(false)} />
            </div>
          ) : null}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Menu size={21} />
            </button>
            <div className="topbar-company">
              <small>{isSuperAdmin ? "Superadmin · Mode Perusahaan" : "Presensi Admin Panel"}</small>
              <strong>{companyName}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            {isSuperAdmin ? (
              <form action={leaveCompany}>
                <button type="submit" className="btn btn-sm btn-outline superadmin-exit-btn" title="Keluar ke Konsol Superadmin">
                  <ArrowLeft size={14} /> Konsol Super Admin
                </button>
              </form>
            ) : null}
            <button className="support-link"><FileText size={14} /> Tutorial</button>
            <button className="support-link"><MessageCircleQuestion size={14} /> Customer Service</button>
            {subscription ? <SubscriptionBell status={subscription} canRenew={canRenew} /> : <button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={19} /></button>}
            <span className="role-pill">{isSuperAdmin ? "Super Admin" : roleLabels[normalizedRole] ?? role}</span>
            <div className="topbar-user" title={userEmail}>
              <span className="avatar">{initials}</span>
              <span><strong>{userName}</strong><small>{userEmail}</small></span>
            </div>
            <button className="icon-button" onClick={logout} title="Keluar" aria-label="Keluar"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="content"><PlatformAnnouncements items={announcements} />{subscription ? <SubscriptionBanner status={subscription} canRenew={canRenew} /> : null}{children}</main>
        {subscription ? <SubscriptionWarningDialog status={subscription} canRenew={canRenew} userKey={userEmail} /> : null}
      </div>
    </div>
  );
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon ?? BarChart3;
  return (
    <Link href={item.href as Route} className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
    </Link>
  );
}
