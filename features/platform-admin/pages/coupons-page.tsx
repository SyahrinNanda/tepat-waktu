import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { TicketPercent } from "lucide-react";
import { db } from "@/db";
import { couponRedemptions, coupons, subscriptionPlans } from "@/db/schema";
import { formatRupiah } from "@/features/subscriptions/plan-rules";
import { couponLabel, couponUsage } from "@/features/subscriptions/server/coupons";
import { CouponCreateButton, CouponDeleteButton, CouponEditButton } from "../components/coupon-form";
import { setCouponActive } from "../server/coupon-actions";

const witaDate = (value: Date | null) => value ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(value) : "";
const day = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(value);

export async function CouponsPage() {
  const now = new Date();
  const [rows, usage, plans, allPlans, everUsed] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.createdAt)),
    couponUsage(),
    db.select({ code: subscriptionPlans.code, name: subscriptionPlans.name }).from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId), gt(subscriptionPlans.monthlyPrice, 0))).orderBy(subscriptionPlans.monthlyPrice),
    // Names for every public plan, so a coupon limited to a since-retired plan still shows its name.
    db.select({ code: subscriptionPlans.code, name: subscriptionPlans.name }).from(subscriptionPlans).where(isNull(subscriptionPlans.companyId)),
    // All redemptions, including cancelled invoices: a coupon that appears on any invoice keeps its code.
    db.select({ couponId: couponRedemptions.couponId, value: count() }).from(couponRedemptions).groupBy(couponRedemptions.couponId),
  ]);
  const usageById = new Map(usage.map((row) => [row.couponId, row]));
  const planName = new Map(allPlans.map((plan) => [plan.code, plan.name]));
  const usedEver = new Map(everUsed.map((row) => [row.couponId, Number(row.value)]));
  const totalDiscount = usage.reduce((sum, row) => sum + Number(row.discount), 0);
  const totalUses = usage.reduce((sum, row) => sum + Number(row.uses), 0);
  const state = (coupon: (typeof rows)[number]) => {
    const used = Number(usageById.get(coupon.id)?.uses ?? 0);
    if (!coupon.active) return { label: "Nonaktif", tone: "gray" };
    if (coupon.endsAt && coupon.endsAt <= now) return { label: "Kedaluwarsa", tone: "gray" };
    if (coupon.maxRedemptions !== null && used >= coupon.maxRedemptions) return { label: "Kuota habis", tone: "orange" };
    if (coupon.startsAt && coupon.startsAt > now) return { label: "Terjadwal", tone: "orange" };
    return { label: "Berlaku", tone: "green" };
  };

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Kupon</span><h1>KUPON & KODE DISKON</h1><p>Kode promo yang bisa dimasukkan admin perusahaan saat memilih atau memperpanjang paket. Diskon dihitung dari harga paket, sebelum biaya admin pembayaran.</p></div><CouponCreateButton plans={plans} /></header>

    <section className="complaint-tiles industry-tiles">
      <article className="complaint-tile total"><span>Kupon berlaku</span><strong>{rows.filter((coupon) => state(coupon).label === "Berlaku").length}</strong><small>dari {rows.length} kupon</small></article>
      <article className="complaint-tile"><span>Total pemakaian</span><strong>{totalUses}</strong><small>Invoice yang memakai kupon</small></article>
      <article className="complaint-tile"><span>Total diskon diberikan</span><strong className="industry-tile-text">{formatRupiah(totalDiscount)}</strong><small>Tidak termasuk invoice ditolak</small></article>
      <article className="complaint-tile"><span>Rata-rata diskon</span><strong className="industry-tile-text">{formatRupiah(totalUses ? Math.round(totalDiscount / totalUses) : 0)}</strong><small>Per invoice</small></article>
    </section>

    <section className="module-card industry-table coupon-table">
      {rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Kode</th><th>Paket</th><th>Diskon</th><th>Syarat</th><th>Masa berlaku</th><th>Pemakaian</th><th>Status</th><th aria-label="Aksi" /></tr></thead>
        <tbody>{rows.map((coupon) => {
          const used = usageById.get(coupon.id);
          const status = state(coupon);
          return <tr key={coupon.id}>
            <td><strong className="coupon-code">{coupon.code}</strong>{coupon.description ? <small className="retention-sub">{coupon.description}</small> : null}</td>
            <td className="coupon-plans-cell">{coupon.planCodes?.length
              ? <span className="coupon-plan-chips">{coupon.planCodes.map((code) => <span className="badge gray" key={code}>{planName.get(code) ?? code}</span>)}</span>
              : <span className="coupon-plan-all">Semua paket berbayar</span>}</td>
            <td><strong>{couponLabel(coupon)}</strong></td>
            <td className="audit-detail">Min. {coupon.minDurationMonths} bulan · {coupon.perCompanyLimit}× per perusahaan</td>
            <td className="audit-detail">{coupon.startsAt ? day(coupon.startsAt) : "Sekarang"} – {coupon.endsAt ? day(coupon.endsAt) : "tanpa batas"}</td>
            <td>{Number(used?.uses ?? 0)}{coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}<small className="retention-sub">Diskon {formatRupiah(Number(used?.discount ?? 0))}</small></td>
            <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
            <td className="retention-actions">
              <CouponEditButton plans={plans} draft={{ id: coupon.id, code: coupon.code, description: coupon.description ?? "", discountType: coupon.discountType, discountValue: coupon.discountValue, minDurationMonths: coupon.minDurationMonths, maxRedemptions: coupon.maxRedemptions, perCompanyLimit: coupon.perCompanyLimit, startsAt: witaDate(coupon.startsAt), endsAt: witaDate(coupon.endsAt), planCodes: coupon.planCodes ?? [], used: usedEver.get(coupon.id) ?? 0 }} />
              <form action={setCouponActive}><input type="hidden" name="id" value={coupon.id} /><input type="hidden" name="active" value={coupon.active ? "false" : "true"} /><button className="btn btn-outline btn-sm" type="submit">{coupon.active ? "Nonaktifkan" : "Aktifkan"}</button></form>
              <CouponDeleteButton id={coupon.id} code={coupon.code} used={usedEver.get(coupon.id) ?? 0} />
            </td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state"><TicketPercent size={26} /><strong>Belum ada kupon</strong><span>Buat kupon pertama, misalnya diskon 20% untuk kontrak 12 bulan.</span></div>}
    </section>
  </>;
}
