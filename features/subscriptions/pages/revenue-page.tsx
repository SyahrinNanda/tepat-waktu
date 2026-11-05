import { Download } from "lucide-react";
import { durationLabel, formatRupiah } from "../plan-rules";
import { getRevenueReport } from "../server/revenue-report";
import { compactRupiah, HorizontalBars, percent, VerticalBars } from "../components/report-charts";

const dayFmt = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(value);
const statusLabel = { verified: "Terverifikasi", awaiting_payment: "Menunggu pembayaran", awaiting_verification: "Menunggu verifikasi" } as const;
const statusTone = { verified: "green", awaiting_payment: "gray", awaiting_verification: "orange" } as const;

export async function RevenuePage() {
  const report = await getRevenueReport();
  const change = report.lastMonth ? Math.round((report.thisMonth - report.lastMonth) / report.lastMonth * 100) : null;
  const current = report.months[11];
  const pendingTotal = report.pending.awaitingPayment.amount + report.pending.awaitingVerification.amount;
  const pendingRows = report.transactions.filter((row) => row.status !== "verified");
  const recent = report.transactions.filter((row) => row.status === "verified").slice(0, 15);

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Pendapatan</span><h1>LAPORAN PENDAPATAN</h1><p>Pendapatan langganan 12 bulan terakhir, dihitung dari nilai paket yang pembayarannya sudah diverifikasi (di luar biaya admin pembayaran).</p></div>
      <a className="btn btn-primary" href="/api/superadmin/revenue/export"><Download size={16} /> Ekspor Excel</a></header>

    <section className="complaint-tiles industry-tiles">
      <article className="complaint-tile total"><span>Pendapatan 12 bulan</span><strong>{compactRupiah(report.total)}</strong><small>{formatRupiah(report.total)} · {report.count} transaksi</small></article>
      <article className="complaint-tile"><span>Bulan ini ({current.label})</span><strong>{compactRupiah(report.thisMonth)}</strong><small>{change === null ? "Bulan lalu belum ada pendapatan" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% dari bulan lalu`}</small></article>
      <article className="complaint-tile"><span>Rata-rata per bulan</span><strong>{compactRupiah(report.average)}</strong><small>12 bulan terakhir</small></article>
      <article className="complaint-tile"><span>Belum masuk</span><strong>{compactRupiah(pendingTotal)}</strong><small>{report.pending.awaitingVerification.count} menunggu verifikasi · {report.pending.awaitingPayment.count} belum bayar</small></article>
    </section>

    <figure className="module-card complaint-chart">
      <figcaption><span className="eyebrow">Tren</span><h2>Pendapatan per bulan</h2></figcaption>
      <VerticalBars highlight={current.key} data={report.months.map((month) => ({ key: month.key, label: month.label, value: month.revenue, display: compactRupiah(month.revenue), tooltip: <>{formatRupiah(month.revenue)}<br />{month.count} transaksi terverifikasi</> }))} />
    </figure>

    <div className="complaint-chart-grid industry-chart-grid">
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">12 bulan</span><h2>Pendapatan per paket</h2></figcaption>
        <HorizontalBars empty="Belum ada pendapatan." data={report.byPlan.map((row) => ({ key: row.label, label: row.label, value: row.revenue, display: compactRupiah(row.revenue), tooltip: <>{formatRupiah(row.revenue)} · {row.count} transaksi<br />{percent(row.revenue, report.total)}% dari total</> }))} />
      </figure>
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">12 bulan</span><h2>Pendapatan per metode bayar</h2></figcaption>
        <HorizontalBars empty="Belum ada pendapatan." data={report.byMethod.map((row) => ({ key: row.label, label: row.label, value: row.revenue, display: compactRupiah(row.revenue), tooltip: <>{formatRupiah(row.revenue)} · {row.count} transaksi<br />{percent(row.revenue, report.total)}% dari total</> }))} />
      </figure>
    </div>

    <section className="module-card industry-table">
      <div className="report-table-head"><h2>Rincian per bulan</h2></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Bulan</th><th>Transaksi</th><th>Pendapatan</th><th>Porsi</th></tr></thead>
        <tbody>{[...report.months].reverse().map((month) => <tr key={month.key}><td><strong>{month.label}</strong></td><td>{month.count}</td><td>{formatRupiah(month.revenue)}</td><td>{percent(month.revenue, report.total)}%</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><th>{report.count}</th><th>{formatRupiah(report.total)}</th><th>100%</th></tr></tfoot>
      </table></div>
    </section>

    <section className="module-card industry-table">
      <div className="report-table-head"><h2>Pembayaran belum masuk</h2><p>Invoice berbayar yang belum dibayar atau menunggu verifikasi di menu Semua Langganan.</p></div>
      {pendingRows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Invoice</th><th>Perusahaan</th><th>Paket</th><th>Dibuat</th><th>Metode</th><th>Tagihan</th><th>Status</th></tr></thead>
        <tbody>{pendingRows.map((row) => <tr key={row.invoiceNumber}><td>{row.invoiceNumber}</td><td>{row.company}</td><td>{row.plan} ({durationLabel(row)})</td><td>{dayFmt(row.createdAt)}</td><td>{row.method}</td><td>{formatRupiah(row.amount)}</td><td><span className={`badge ${statusTone[row.status]}`}>{statusLabel[row.status]}</span></td></tr>)}</tbody>
      </table></div> : <p className="report-empty">Tidak ada pembayaran yang tertunda.</p>}
    </section>

    <section className="module-card industry-table">
      <div className="report-table-head"><h2>Transaksi terverifikasi terbaru</h2><p>Daftar lengkap ada di file Excel.</p></div>
      {recent.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Diverifikasi</th><th>Invoice</th><th>Perusahaan</th><th>Paket</th><th>Metode</th><th>Pendapatan</th><th>Biaya admin</th></tr></thead>
        <tbody>{recent.map((row) => <tr key={row.invoiceNumber}><td>{row.verifiedAt ? dayFmt(row.verifiedAt) : "—"}</td><td>{row.invoiceNumber}</td><td>{row.company}</td><td>{row.plan} ({durationLabel(row)})</td><td>{row.method}</td><td>{formatRupiah(row.revenue)}</td><td>{formatRupiah(row.adminFee)}</td></tr>)}</tbody>
      </table></div> : <p className="report-empty">Belum ada transaksi terverifikasi dalam 12 bulan terakhir.</p>}
    </section>
  </>;
}
