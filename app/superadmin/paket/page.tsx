import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { CheckCircle2, CreditCard, Sparkles, Tags } from "lucide-react";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { PlansManagementTable, type PlanItem } from "./plans-management-table";

export const metadata: Metadata = { title: "Paket & Harga" };

export default async function Page() {
  await requireSuperAdmin();
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(asc(subscriptionPlans.monthlyPrice));

  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.active).length;
  const freePlans = plans.filter((p) => p.monthlyPrice === 0).length;
  const paidPlans = plans.filter((p) => p.monthlyPrice > 0).length;

  return (
    <>
      <header className="product-page-header">
        <div>
          <span className="breadcrumb">Presensi Super Admin Panel</span>
          <h1>DAFTAR PAKET & HARGA</h1>
          <p>
            Kelola daftar paket langganan, tarif bulanan, batas kapasitas karyawan, serta status ketersediaan paket.
          </p>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon blue">
              <Tags size={19} />
            </span>
          </div>
          <div className="stat-label">Total Tingkatan Paket</div>
          <div className="stat-value">{totalPlans}</div>
          <div className="stat-meta">Paket terkonfigurasi</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green">
              <CheckCircle2 size={19} />
            </span>
          </div>
          <div className="stat-label">Paket Aktif Dijual</div>
          <div className="stat-value">{activePlans}</div>
          <div className="stat-meta">Dapat dipilih tenant</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon purple" style={{ color: "#7c3aed", background: "#f3e8ff" }}>
              <Sparkles size={19} />
            </span>
          </div>
          <div className="stat-label">Paket Gratis / Starter</div>
          <div className="stat-value">{freePlans}</div>
          <div className="stat-meta">Tanpa biaya berlangganan</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon orange">
              <CreditCard size={19} />
            </span>
          </div>
          <div className="stat-label">Paket Berbayar (Tier)</div>
          <div className="stat-value">{paidPlans}</div>
          <div className="stat-meta">Skala kecil s/d enterprise</div>
        </article>
      </section>

      <section className="module-card">
        <PlansManagementTable plans={plans as PlanItem[]} />
      </section>
    </>
  );
}
