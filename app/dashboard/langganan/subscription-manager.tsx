"use client";

import Link from "next/link";
import { resolveTimeZone } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, PackageCheck, X } from "lucide-react";
import { cancelSubscription, previewCoupon, requestPayment, requestSubscription, type ActionState } from "./actions";
import { CouponField } from "@/features/subscriptions/components/coupon-field";
import { durationLabel } from "@/features/subscriptions/plan-rules";

type Plan = { id: string; code: string; name: string; monthlyPrice: number; maxEmployees: number; description: string };
type Order = {
  id: string;
  invoiceNumber: string;
  amount: number;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  adminFee: number;
  status: string;
  paymentMethod: string | null;
  durationMonths: number;
  durationDays: number;
  transactionType: string;
  createdAt: string;
  planName: string;
};

const idle: ActionState = { status: "idle", message: "" };
const paymentLabels: Record<string, string> = {
  credit_card: "Kartu Kredit",
  bank_transfer: "Bank Transfer",
  shopeepay: "ShopeePay",
  indomaret: "Indomaret",
  alfamart: "Alfamart",
  akulaku: "Akulaku Paylater",
  qris: "QRIS",
  manual: "Manual",
};

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const dateTime = (value: string, timeZone?: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: resolveTimeZone(timeZone) }).format(new Date(value));

function DurationModal({ plan, mode, onClose }: { plan: Plan; mode: "renewal" | "upgrade"; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(requestSubscription, idle);
  const [months, setMonths] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === "success" && state.orderId) router.push(`/dashboard/langganan?invoice=${state.orderId}`);
  }, [router, state.orderId, state.status]);

  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog duration-dialog" role="dialog" aria-modal="true" aria-labelledby="duration-title">
      <header><h2 id="duration-title">Pilih Durasi {mode === "renewal" ? "Perpanjangan" : "Upgrade"} Paket</h2><button type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      <form action={action}>
        <div className="subscription-dialog-body">
          <p>Pilih Durasi Masa Aktif {mode === "renewal" ? "Perpanjangan" : "Upgrade"} Paket Perusahaan</p>
          <label><span>(Pilih Bulan Masa Aktif)</span><select name="durationMonths" defaultValue="" required onChange={(event) => setMonths(Number(event.target.value) || null)}><option value="" disabled>Pilih Bulan</option><option value="1">1 Bulan</option><option value="3">3 Bulan</option><option value="6">6 Bulan</option><option value="8">8 Bulan</option><option value="12">12 Bulan</option></select></label>
          <input type="hidden" name="planId" value={plan.id} />
          {plan.monthlyPrice > 0 && <CouponField planId={plan.id} durationMonths={months} subtotal={plan.monthlyPrice * (months ?? 1)} preview={previewCoupon} />}
          {state.status === "error" && <p className="subscription-form-error" role="alert">{state.message}</p>}
          <button className="subscription-blue-button" type="submit" disabled={pending}>{pending ? "MEMPROSES..." : mode === "renewal" ? "PERPANJANG PAKET" : "UPGRADE PAKET"}</button>
        </div>
      </form>
    </section>
  </div>;
}

function CancelModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(cancelSubscription, idle);
  useEffect(() => { if (state.status === "success") onClose(); }, [state.status, onClose]);
  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title">
      <button className="floating-close" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      <div className="subscription-warning"><AlertTriangle size={42} /></div>
      <h2 id="cancel-title">Pemberitahuan!</h2><p>Anda yakin ingin menghentikan langganan? Akses seluruh akun perusahaan akan langsung ditutup sampai Anda memilih paket baru.</p>
      {state.status === "error" && <p className="subscription-form-error" role="alert">{state.message}</p>}
      <form action={action}><button className="subscription-blue-button" type="submit" disabled={pending}>{pending ? "Memproses..." : "Ya"}</button><button className="subscription-gray-button" type="button" onClick={onClose}>Batal</button></form>
    </section>
  </div>;
}

function InvoiceModal({ order, companyName, timezone, onClose }: { order: Order; companyName: string; timezone?: string; onClose: () => void }) {
  const [method, setMethod] = useState(order.paymentMethod ?? "");
  const [state, action, pending] = useActionState(requestPayment, idle);
  const estimatedFee = useMemo(() => {
    if (!method) return order.adminFee;
    if (method === "credit_card") return Math.round(order.subtotal * .036);
    if (method === "shopeepay") return Math.round(order.subtotal * .015);
    if (method === "akulaku") return Math.round(order.subtotal * .02);
    if (method === "qris") return Math.round(order.subtotal * .007);
    if (method === "bank_transfer") return 4_000;
    return 5_000;
  }, [method, order.adminFee, order.subtotal]);
  const total = Math.max(0, order.subtotal - order.discountAmount + estimatedFee);
  const pendingPayment = order.status === "pending";

  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog invoice-reference-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <button className="floating-close" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      <div className="invoice-reference-sheet" id="subscription-invoice">
        <div className="invoice-reference-head"><span><PackageCheck size={22} /> TepatWaktu</span><small>{dateTime(order.createdAt, timezone)}<br />{companyName}</small></div>
        <div className={`invoice-status-band ${order.status}`}>{order.status === "active" ? "LUNAS" : order.status === "rejected" ? "DITOLAK" : order.status === "cancelled" ? "DIBATALKAN" : "MENUNGGU PEMBAYARAN"}</div>
        <div className="invoice-reference-customer"><strong>{companyName}</strong><span><b id="invoice-title">INVOICE</b><small>{order.invoiceNumber}</small></span></div>
        <div className="invoice-reference-lines"><span><b>Ringkasan Biaya</b><b>Harga</b></span><span><span>Paket {order.planName} ({durationLabel(order)})</span><span>{money(order.subtotal)}</span></span><span><span>{order.couponCode ? `Diskon kupon ${order.couponCode}` : "Diskon"}</span><span>− {money(order.discountAmount)}</span></span><span><span>Biaya Admin</span><span>{money(estimatedFee)}</span></span><strong>Total {money(total)}</strong></div>
        <footer>TepatWaktu ©2026</footer>
      </div>
      <form action={action} className="invoice-payment-row">
        <input type="hidden" name="orderId" value={order.id} />
        <button type="button" className="invoice-download" onClick={() => window.print()} aria-label="Cetak invoice"><Download size={17} /></button>
        <select name="paymentMethod" value={method} onChange={(event) => setMethod(event.target.value)} disabled={!pendingPayment} required>
          <option value="">Pilih Metode Bayar</option>{Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <button type="submit" disabled={!pendingPayment || !method || pending}>{pending ? "Memproses..." : pendingPayment ? "Bayar Sekarang" : "Pembayaran Selesai"}</button>
      </form>
      {state.message && <p className={`invoice-action-message ${state.status}`} role="status">{state.message}</p>}
    </section>
  </div>;
}

export function SubscriptionManager({ companyName, timezone, currentPlan, recommendedPlan, employeeCount, expiresAt, orders, canManage, initialInvoiceId }: { companyName: string; timezone?: string; currentPlan: Plan; recommendedPlan: Plan | null; employeeCount: number; expiresAt: string | null; orders: Order[]; canManage: boolean; initialInvoiceId?: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<"renewal" | "upgrade" | "cancel" | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [dismissedInvoiceId, setDismissedInvoiceId] = useState<string | null>(null);
  const effectiveInvoiceId = selectedInvoiceId ?? (initialInvoiceId !== dismissedInvoiceId ? initialInvoiceId : null);
  const invoice = orders.find((order) => order.id === effectiveInvoiceId) ?? null;
  const usage = Math.min(100, currentPlan.maxEmployees ? (employeeCount / currentPlan.maxEmployees) * 100 : 0);
  const pendingOrder = orders.find((order) => order.status === "pending");

  return <>
    {pendingOrder && <div className="subscription-notice">Langganan Anda sedang dalam proses pembayaran atau verifikasi. Selesaikan pembayaran agar paket segera aktif.</div>}
    <div className="subscription-overview-grid">
      <section className="subscription-current-card">
        <div className="subscription-current-top"><div><span>PAKET {currentPlan.name.toUpperCase()}</span><p>{expiresAt ? <>Berakhir pada <strong>{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: resolveTimeZone(timezone) }).format(new Date(expiresAt))}</strong></> : "Masa aktif belum ditentukan"}</p></div><b>{money(currentPlan.monthlyPrice)}<small>/bulan</small></b></div>
        <div className="subscription-capacity-copy"><span>Karyawan Maksimal</span><span>{employeeCount} / {currentPlan.maxEmployees} ({usage.toFixed(2)}%)</span></div>
        <div className="subscription-capacity-meter"><i style={{ width: `${usage}%` }} /></div>
        <div className="subscription-card-actions"><button type="button" disabled={!canManage} onClick={() => setModal("cancel")}>Berhenti Berlangganan</button><button type="button" disabled={!canManage} onClick={() => setModal("renewal")}>Perpanjang Paket</button></div>
      </section>
      <section className="subscription-upgrade-card">
        {recommendedPlan ? <><strong>Upgrade paketmu ke Paket {recommendedPlan.name.toUpperCase()} dan dapatkan Max {recommendedPlan.maxEmployees} karyawan hanya dengan {money(recommendedPlan.monthlyPrice)}/bulan</strong><p>{recommendedPlan.description}</p><div><Link href="/dashboard/langganan/paket">Lihat paket lainnya</Link><button type="button" disabled={!canManage} onClick={() => setModal("upgrade")}>Upgrade ke Paket {recommendedPlan.name.toUpperCase()}</button></div></> : <><strong>Butuh lebih dari 1.000 karyawan?</strong><p>Ajukan Paket Custom dengan harga per karyawan yang bisa dinegosiasikan.</p><div><Link href="/dashboard/langganan/paket#paket-custom">Ajukan Paket Custom</Link></div></>}
      </section>
    </div>
    <section className="subscription-history-card"><div className="table-scroll"><table><thead><tr><th>#</th><th>Hari/Tanggal</th><th>No. Invoice</th><th>Paket</th><th>Tagihan</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{orders.map((order, index) => <tr key={order.id}><td>{index + 1}</td><td>{dateTime(order.createdAt, timezone)}</td><td>{order.invoiceNumber}</td><td>Paket {order.planName}</td><td>{money(order.amount)}</td><td><span className={`subscription-table-status ${order.status}`}>{order.status === "active" ? "Lunas" : order.status === "rejected" ? "Ditolak" : order.status === "cancelled" ? "Dibatalkan" : "Menunggu Pembayaran"}</span></td><td><button type="button" className={order.status === "pending" ? "pay" : "detail"} onClick={() => setSelectedInvoiceId(order.id)}>{order.status === "pending" ? "BAYAR" : "Detail"}</button></td></tr>)}</tbody></table>{orders.length === 0 && <div className="empty-state">Belum ada riwayat invoice.</div>}</div></section>
    {modal === "renewal" && <DurationModal plan={currentPlan} mode="renewal" onClose={() => setModal(null)} />}
    {modal === "upgrade" && recommendedPlan && <DurationModal plan={recommendedPlan} mode="upgrade" onClose={() => setModal(null)} />}
    {modal === "cancel" && <CancelModal onClose={() => setModal(null)} />}
    {invoice && <InvoiceModal order={invoice} companyName={companyName} timezone={timezone} onClose={() => { setSelectedInvoiceId(null); setDismissedInvoiceId(invoice.id); router.replace("/dashboard/langganan"); }} />}
  </>;
}
