"use client";

import Link from "next/link";
import { resolveTimeZone } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, PackageCheck, X } from "lucide-react";
import { cancelSubscription, checkPayment, previewCoupon, requestPayment, requestSubscription, type ActionState, type PaymentState } from "./actions";
import { CouponField } from "@/features/subscriptions/components/coupon-field";
import { durationLabel, ONLINE_PAYMENT_METHODS, PAYMENT_LABELS, paymentAdminFee } from "@/features/subscriptions/plan-rules";

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
  gatewayStatus: string | null;
  durationMonths: number;
  durationDays: number;
  transactionType: string;
  createdAt: string;
  planName: string;
};

const idle: ActionState = { status: "idle", message: "" };
const idlePayment: PaymentState = { status: "idle", message: "" };
type MidtransPublic = { clientKey: string; snapJsUrl: string } | null;
type SnapCallbacks = { onSuccess?: () => void; onPending?: () => void; onError?: () => void; onClose?: () => void };
declare global { interface Window { snap?: { pay: (token: string, callbacks: SnapCallbacks) => void } } }

/** Loads Midtrans snap.js once (sandbox or production URL comes from the server). */
function loadSnap(config: NonNullable<MidtransPublic>) {
  if (window.snap) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-midtrans-snap]");
    const script = existing ?? Object.assign(document.createElement("script"), { src: config.snapJsUrl, async: true });
    script.dataset.midtransSnap = "true";
    script.dataset.clientKey = config.clientKey;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Snap gagal dimuat")), { once: true });
    if (!existing) document.body.appendChild(script);
  });
}

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

function InvoiceModal({ order, companyName, timezone, midtrans, onClose }: { order: Order; companyName: string; timezone?: string; midtrans: MidtransPublic; onClose: () => void }) {
  const router = useRouter();
  const [method, setMethod] = useState(order.paymentMethod && order.paymentMethod !== "manual" ? order.paymentMethod : "");
  const [state, action, pending] = useActionState(requestPayment, idlePayment);
  const [notice, setNotice] = useState("");
  const handledToken = useRef<string | null>(null);
  const packagePrice = order.subtotal - order.discountAmount;
  const pendingPayment = order.status === "pending";
  const adminFee = pendingPayment && method ? paymentAdminFee(method, packagePrice) : order.adminFee;
  const total = pendingPayment && method ? packagePrice + adminFee : order.amount;

  // Open Midtrans Snap once the server returns a token.
  useEffect(() => {
    if (!state.token || !midtrans || handledToken.current === state.token) return;
    handledToken.current = state.token;
    const finish = (path: "berhasil" | "gagal") => router.push(path === "berhasil" ? `/dashboard/langganan/pembayaran/berhasil?invoice=${order.id}` : `/dashboard/langganan/pembayaran/gagal?invoice=${order.id}`);
    loadSnap(midtrans).then(() => window.snap?.pay(state.token!, {
      onSuccess: () => finish("berhasil"),
      onPending: () => finish("berhasil"),
      onError: () => finish("gagal"),
      onClose: () => {
        setNotice("Jendela pembayaran ditutup. Mengecek status pembayaran…");
        void checkPayment(order.id).then(({ paid }) => {
          setNotice(paid ? "Pembayaran diterima. Paket sudah aktif." : "Pembayaran belum selesai. Klik Bayar Sekarang untuk melanjutkan.");
          router.refresh();
        });
      },
    })).catch(() => {
      if (state.redirectUrl) window.location.href = state.redirectUrl;
      else setNotice("Halaman pembayaran Midtrans gagal dimuat. Periksa koneksi lalu coba lagi.");
    });
  }, [midtrans, order.id, router, state.redirectUrl, state.token]);

  const statusLabel = order.status === "active" ? "LUNAS" : order.status === "rejected" ? "DITOLAK" : order.status === "cancelled" ? "DIBATALKAN"
    : order.gatewayStatus === "pending" ? "MENUNGGU PEMBAYARAN DI MIDTRANS" : "MENUNGGU PEMBAYARAN";
  const message = notice || (state.status !== "idle" && !state.token ? state.message : "");

  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <header className="invoice-modal-head">
        <div><span>Invoice</span><h2 id="invoice-title">{order.invoiceNumber}</h2></div>
        <button type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </header>
      <div className="invoice-modal-body">
        <div className="invoice-reference-sheet invoice-paper" id="subscription-invoice">
          <div className="invoice-paper-top"><span><PackageCheck size={20} /> TepatWaktu</span><small>{dateTime(order.createdAt, timezone)}</small></div>
          <div className={`invoice-status-band ${order.status}`}>{statusLabel}</div>
          <dl className="invoice-paper-meta">
            <div><dt>Ditagihkan kepada</dt><dd>{companyName}</dd></div>
            <div><dt>No. invoice</dt><dd>{order.invoiceNumber}</dd></div>
          </dl>
          <div className="invoice-paper-lines">
            <div className="invoice-line head"><span>Ringkasan biaya</span><span>Harga</span></div>
            <div className="invoice-line"><span>Paket {order.planName} ({durationLabel(order)})</span><span>{money(order.subtotal)}</span></div>
            <div className="invoice-line"><span>{order.couponCode ? `Diskon kupon ${order.couponCode}` : "Diskon"}</span><span>− {money(order.discountAmount)}</span></div>
            <div className="invoice-line"><span>Biaya admin</span><span>{money(adminFee)}</span></div>
            <div className="invoice-line total"><span>Total</span><strong>{money(total)}</strong></div>
          </div>
          <footer>TepatWaktu ©{new Date(order.createdAt).getFullYear()}</footer>
        </div>
      </div>
      <form action={action} className="invoice-modal-pay">
        <input type="hidden" name="orderId" value={order.id} />
        {pendingPayment && <label className="invoice-method"><span>Metode pembayaran</span>
          <select name="paymentMethod" value={method} onChange={(event) => setMethod(event.target.value)} required>
            <option value="">Pilih metode bayar</option>{ONLINE_PAYMENT_METHODS.map((value) => <option value={value} key={value}>{PAYMENT_LABELS[value]}</option>)}
          </select>
        </label>}
        <div className="invoice-modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => window.print()}><Download size={16} /> Cetak</button>
          {pendingPayment
            ? <button type="submit" className="btn btn-primary" disabled={!method || pending}>{pending ? "Memproses..." : `Bayar ${money(total)}`}</button>
            : <button type="button" className="btn btn-primary" onClick={onClose}>Tutup</button>}
        </div>
        {pendingPayment && <p className="invoice-payment-note">{midtrans ? "Pembayaran diproses aman oleh Midtrans. Paket aktif otomatis setelah pembayaran diterima." : "Pembayaran online belum aktif. Setelah memilih metode, pembayaran diverifikasi manual oleh admin TepatWaktu."}</p>}
        {message && <p className={`invoice-action-message ${state.status === "error" ? "error" : "success"}`} role="status">{message}</p>}
      </form>
    </section>
  </div>;
}

export function SubscriptionManager({ companyName, timezone, currentPlan, recommendedPlan, employeeCount, expiresAt, orders, canManage, initialInvoiceId, midtrans }: { companyName: string; timezone?: string; currentPlan: Plan; recommendedPlan: Plan | null; employeeCount: number; expiresAt: string | null; orders: Order[]; canManage: boolean; initialInvoiceId?: string; midtrans: MidtransPublic }) {
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
        {recommendedPlan ? <><strong>Upgrade paketmu ke Paket {recommendedPlan.name.toUpperCase()} dan dapatkan Max {recommendedPlan.maxEmployees} karyawan hanya dengan {money(recommendedPlan.monthlyPrice)}/bulan</strong><p>{recommendedPlan.description}</p><div><Link href="/dashboard/langganan/paket">Lihat paket lainnya</Link><button type="button" disabled={!canManage} onClick={() => setModal("upgrade")}>Upgrade ke Paket {recommendedPlan.name.toUpperCase()}</button></div></> : <><strong>Butuh lebih dari 1.000 karyawan?</strong><p>Ajukan Paket Custom dengan harga khusus per karyawan.</p><div><Link href="/dashboard/langganan/paket#paket-custom">Ajukan Paket Custom</Link></div></>}
      </section>
    </div>
    <section className="subscription-history-card"><div className="table-scroll"><table><thead><tr><th>#</th><th>Hari/Tanggal</th><th>No. Invoice</th><th>Paket</th><th>Tagihan</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{orders.map((order, index) => <tr key={order.id}><td>{index + 1}</td><td>{dateTime(order.createdAt, timezone)}</td><td>{order.invoiceNumber}</td><td>Paket {order.planName}</td><td>{money(order.amount)}</td><td><span className={`subscription-table-status ${order.status}`}>{order.status === "active" ? "Lunas" : order.status === "rejected" ? "Ditolak" : order.status === "cancelled" ? "Dibatalkan" : "Menunggu Pembayaran"}</span></td><td><button type="button" className={order.status === "pending" ? "pay" : "detail"} onClick={() => setSelectedInvoiceId(order.id)}>{order.status === "pending" ? "BAYAR" : "Detail"}</button></td></tr>)}</tbody></table>{orders.length === 0 && <div className="empty-state">Belum ada riwayat invoice.</div>}</div></section>
    {modal === "renewal" && <DurationModal plan={currentPlan} mode="renewal" onClose={() => setModal(null)} />}
    {modal === "upgrade" && recommendedPlan && <DurationModal plan={recommendedPlan} mode="upgrade" onClose={() => setModal(null)} />}
    {modal === "cancel" && <CancelModal onClose={() => setModal(null)} />}
    {invoice && <InvoiceModal order={invoice} companyName={companyName} timezone={timezone} midtrans={midtrans} onClose={() => { setSelectedInvoiceId(null); setDismissedInvoiceId(invoice.id); router.replace("/dashboard/langganan"); }} />}
  </>;
}
