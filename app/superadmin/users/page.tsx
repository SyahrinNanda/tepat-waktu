import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import { Shield, UserCheck, Users } from "lucide-react";
import { db } from "@/db";
import { companies, companyMembers, employees, user } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { UserManagementTable, type UserRow } from "./user-management-table";

export const metadata: Metadata = { title: "Kelola Seluruh Akun" };

export default async function Page() {
  const session = await requireSuperAdmin();

  const userRecords = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      platformRole: user.platformRole,
      createdAt: user.createdAt,
      companyId: companies.id,
      companyName: companies.name,
      companyRole: companyMembers.role,
      employeeCode: employees.employeeCode,
      employeePosition: employees.position,
    })
    .from(user)
    .leftJoin(companyMembers, eq(user.id, companyMembers.userId))
    .leftJoin(companies, eq(companyMembers.companyId, companies.id))
    .leftJoin(
      employees,
      and(eq(user.id, employees.userId), eq(companyMembers.companyId, employees.companyId)),
    )
    .orderBy(desc(user.createdAt));

  const workspaceRecords = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(asc(companies.name));

  const uniqueUsers = new Map(userRecords.map((record) => [record.id, record]));
  const totalUsers = uniqueUsers.size;
  const totalSuperAdmins = [...uniqueUsers.values()].filter((u) => u.platformRole === "superadmin").length;
  const totalTenantUsers = new Set(userRecords.filter((u) => u.companyId !== null).map((u) => u.id)).size;

  return (
    <>
      <header className="product-page-header">
        <div>
          <span className="breadcrumb">Presensi Super Admin Panel</span>
          <h1>DAFTAR USER PLATFORM</h1>
          <p>
            Daftar seluruh pengguna platform, kelola peran Super Admin, atur ulang kata sandi, dan pantau ruang kerja masing-masing akun.
          </p>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon blue">
              <Users size={19} />
            </span>
          </div>
          <div className="stat-label">Total Seluruh Akun</div>
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-meta">Terdaftar di sistem</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
              <Shield size={19} />
            </span>
          </div>
          <div className="stat-label">Super Administrator</div>
          <div className="stat-value">{totalSuperAdmins}</div>
          <div className="stat-meta">Hak akses platform penuh</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green">
              <UserCheck size={19} />
            </span>
          </div>
          <div className="stat-label">Akun Terhubung Perusahaan</div>
          <div className="stat-value">{totalTenantUsers}</div>
          <div className="stat-meta">Anggota ruang kerja aktif</div>
        </article>
      </section>

      <section className="module-card">
        <UserManagementTable
          users={userRecords as UserRow[]}
          workspaces={workspaceRecords}
          currentUserId={session.user.id}
        />
      </section>
    </>
  );
}

