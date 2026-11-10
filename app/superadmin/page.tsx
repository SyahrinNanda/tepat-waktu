import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import {
  BookOpen,
  Building2,
  CreditCard,
  Layers,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { companies, employees, subscriptionOrders, user } from "@/db/schema";
import { enterCompany } from "./actions";
import { requireSuperAdmin } from "@/lib/superadmin";
import { IndustryAnalyticsSection } from "@/features/subscriptions/components/industry-analytics";
import { getIndustryAnalytics } from "@/features/subscriptions/server/industry-analytics";

export const metadata: Metadata = { title: "Beranda & Tenant" };

export default async function Page() {
  await requireSuperAdmin();
  const [companyRows, [totalUsersResult], [totalEmployeesResult], [pendingInvoicesResult], industryAnalytics] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        industry: companies.industry,
        plan: companies.plan,
        timezone: companies.timezone,
        employeeCount: count(employees.id),
      })
      .from(companies)
      .leftJoin(employees, eq(companies.id, employees.companyId))
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt)),
    db.select({ count: count(user.id) }).from(user),
    db.select({ count: count(employees.id) }).from(employees).where(eq(employees.status, "active")),
    db.select({ count: count(subscriptionOrders.id) }).from(subscriptionOrders).where(eq(subscriptionOrders.status, "pending")),
    getIndustryAnalytics(),
  ]);

  const totalCompanies = companyRows.length;
  const totalUsers = Number(totalUsersResult?.count ?? 0);
  const totalEmployees = Number(totalEmployeesResult?.count ?? 0);
  const pendingInvoices = Number(pendingInvoicesResult?.count ?? 0);

  return (
    <>
      <header className="product-page-header">
        <div>
          <span className="breadcrumb">Kehadiran Super Admin Panel</span>
          <h1>DASHBOARD SUPER ADMIN</h1>
          <p>
            Kelola data multi-tenant, pantau operasional seluruh perusahaan, dan masuk ke ruang kerja sebagai Admin.
          </p>
        </div>
      </header>

      <section className="stats-grid superadmin-stats">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon blue">
              <Building2 size={19} />
            </span>
          </div>
          <div className="stat-label">Total Perusahaan (Tenant)</div>
          <div className="stat-value">{totalCompanies}</div>
          <div className="stat-meta">Ruang kerja terdaftar</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green">
              <Users size={19} />
            </span>
          </div>
          <div className="stat-label">Total Pengguna Terdaftar</div>
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-meta">Akun pengguna sistem</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon purple" style={{ color: "#7c3aed", background: "#f3e8ff" }}>
              <Layers size={19} />
            </span>
          </div>
          <div className="stat-label">Total Karyawan Aktif</div>
          <div className="stat-value">{totalEmployees}</div>
          <div className="stat-meta">Di seluruh perusahaan</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon orange">
              <CreditCard size={19} />
            </span>
          </div>
          <div className="stat-label">Invoice Menunggu Verifikasi</div>
          <div className="stat-value">{pendingInvoices}</div>
          <div className="stat-meta">Perlu review & aktivasi</div>
        </article>
      </section>

      <section className="superadmin-entry-actions">
        <Link className="module-card superadmin-entry-link" href="/superadmin/users">
          <Users />
          <span>
            <strong>Kelola Seluruh Akun</strong>
            <small>Atur role platform, reset sandi, dan hapus user</small>
          </span>
        </Link>
        <Link className="module-card superadmin-entry-link" href="/superadmin/perusahaan">
          <Building2 />
          <span>
            <strong>Semua Perusahaan</strong>
            <small>Detail seluruh tenant yang terdaftar di TepatWaktu</small>
          </span>
        </Link>
        <Link className="module-card superadmin-entry-link" href="/superadmin/langganan">
          <CreditCard />
          <span>
            <strong>Kelola Langganan</strong>
            <small>Verifikasi pengajuan invoice & upgrade paket</small>
          </span>
        </Link>
        <Link className="module-card superadmin-entry-link" href="/superadmin/paket">
          <Tags />
          <span>
            <strong>Paket & Harga</strong>
            <small>Kelola daftar paket, batas karyawan & tarif bulanan</small>
          </span>
        </Link>
        <Link className="module-card superadmin-entry-link" href="/superadmin/pengaturan">
          <Settings />
          <span>
            <strong>Pengaturan Platform</strong>
            <small>Konfigurasi sistem, jam kerja global & keamanan</small>
          </span>
        </Link>
        <Link className="module-card superadmin-entry-link" href="/superadmin/pengaturan">
          <BookOpen />
          <span>
            <strong>Dokumentasi Platform</strong>
            <small>Panduan integrasi & kebijakan operasional sistem</small>
          </span>
        </Link>
      </section>

      <IndustryAnalyticsSection data={industryAnalytics} />

      <section className="module-card">
        <div className="module-toolbar">
          <div>
            <strong style={{ fontSize: "14px", color: "var(--ink)", display: "block" }}>
              Ruang Kerja Perusahaan (Tenant)
            </strong>
            <small style={{ color: "var(--muted)", fontSize: "12px" }}>
              Pilih ruang kerja untuk masuk dan mengelola data perusahaan dengan hak akses Admin penuh
            </small>
          </div>
          <div className="toolbar-spacer" />
          <Link href="/superadmin/perusahaan" className="btn btn-outline btn-compact">
            Lihat Semua ({companyRows.length})
          </Link>
        </div>

        {companyRows.length ? (
          <div className="company-picker-grid">
            {companyRows.map((company) => (
              <article className="company-picker-card" key={company.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span className="company-picker-icon">
                    <Building2 size={22} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3>{company.name}</h3>
                    <p style={{ margin: "2px 0 8px" }}>
                      {company.industry} · <span className="status-pill green">Paket {company.plan}</span>
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", color: "#6c6862", fontSize: "12px" }}>
                      <span><Users size={14} /> {Number(company.employeeCount)} karyawan</span>
                      <small style={{ color: "#9d9a96" }}>{company.timezone}</small>
                    </div>
                  </div>
                </div>
                <form action={enterCompany}>
                  <input type="hidden" name="companyId" value={company.id} />
                  <button className="btn btn-primary btn-block" type="submit">
                    Masuk sebagai Admin
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Building2 size={30} />
            <strong>Belum ada perusahaan</strong>
            <span>Perusahaan yang mendaftar akan muncul di sini.</span>
          </div>
        )}
      </section>
    </>
  );
}
