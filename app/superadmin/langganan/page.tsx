import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { date, rupiah } from "@/lib/subscription-format";
import { reviewSubscription } from "./actions";
import { PAYMENT_LABELS } from "@/features/subscriptions/plan-rules";

/** How the invoice was (or is being) paid, for the superadmin list. */
function paymentInfo(row: { status: string; paymentMethod: string | null; gatewayStatus: string | null; paidAt: Date | null; verifiedBy: string | null; amount: number }) {
  const method = row.paymentMethod ? PAYMENT_LABELS[row.paymentMethod]?.split(" (")[0] ?? row.paymentMethod : null;
  if (row.status === "active" && row.paidAt) return `Lunas via Midtrans${method ? ` · ${method}` : ""}`;
  if (row.status === "active") return row.amount > 0 ? "Diverifikasi manual" : "Gratis / kupon";
  if (row.status !== "pending") return method ?? "—";
  if (row.gatewayStatus) return `${method ?? "Midtrans"} · status Midtrans: ${row.gatewayStatus}`;
  return method ? `${method} · belum dibayar` : "Belum memilih metode";
}

export const metadata: Metadata = { title: "Langganan Platform" };
export default async function Page() {
  const rows = await db.select({ id: subscriptionOrders.id, invoiceNumber: subscriptionOrders.invoiceNumber, amount: subscriptionOrders.amount, status: subscriptionOrders.status, createdAt: subscriptionOrders.createdAt, companyName: companies.name, planName: subscriptionPlans.name, paymentMethod: subscriptionOrders.paymentMethod, gatewayStatus: subscriptionOrders.gatewayStatus, paidAt: subscriptionOrders.paidAt, verifiedBy: subscriptionOrders.verifiedBy })
    .from(subscriptionOrders).innerJoin(companies, eq(subscriptionOrders.companyId, companies.id)).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id)).orderBy(desc(subscriptionOrders.createdAt));
  return <><header className="product-page-header"><div><span className="breadcrumb">Kehadiran Super Admin Panel</span><h1>DAFTAR LANGGANAN</h1><p>Periksa pembayaran di luar aplikasi sebelum mengaktifkan paket berbayar.</p></div></header><section className="module-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Perusahaan</th><th>Paket</th><th>Jumlah</th><th>Pembayaran</th><th>Status</th><th>Diajukan</th><th>Tindakan</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.invoiceNumber}</strong></td><td>{row.companyName}</td><td>{row.planName}</td><td>{rupiah(row.amount)}</td><td className="audit-detail">{paymentInfo(row)}</td><td><span className={`status-pill ${row.status === "active" ? "green" : row.status === "rejected" ? "red" : row.status === "pending" ? "orange" : "gray"}`}>{row.status === "active" ? "Aktif" : row.status === "rejected" ? "Ditolak" : row.status === "pending" ? "Menunggu" : "Dibatalkan"}</span></td><td>{date(row.createdAt)}</td><td>{row.status === "pending" ? <div className="inline-actions"><form action={reviewSubscription}><input type="hidden" name="orderId" value={row.id} /><input type="hidden" name="decision" value="active" /><button className="btn btn-sm btn-primary" type="submit">Aktifkan</button></form><form action={reviewSubscription}><input type="hidden" name="orderId" value={row.id} /><input type="hidden" name="decision" value="rejected" /><button className="btn btn-sm btn-outline" type="submit">Tolak</button></form></div> : "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state">Belum ada pengajuan langganan.</div>}</div></section></>;
}
