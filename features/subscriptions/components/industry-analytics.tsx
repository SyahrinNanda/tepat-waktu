import { formatRupiah } from "../plan-rules";
import type { IndustryAnalytics, IndustryRow } from "../server/industry-analytics";

const compactRupiah = (value: number) => value === 0 ? "Rp 0" : `Rp ${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
const percent = (part: number, whole: number) => whole ? Math.round(part / whole * 100) : 0;

function Bars({ rows, value, label, tooltip, empty }: { rows: IndustryRow[]; value: (row: IndustryRow) => number; label: (row: IndustryRow) => string; tooltip: (row: IndustryRow) => React.ReactNode; empty: string }) {
  const max = Math.max(0, ...rows.map(value));
  if (!max) return <p className="complaint-chart-empty">{empty}</p>;
  return <ol className="complaint-hbars industry-hbars">{rows.map((row) => {
    const amount = value(row);
    return <li key={row.industry} tabIndex={0} aria-label={`${row.industry}: ${label(row)}`}>
      <span className="complaint-hbar-label">{row.industry}</span>
      <span className="complaint-hbar-track"><span className="complaint-hbar-fill" style={{ width: `${amount ? Math.max(amount / max * 100, 2) : 0}%` }} /></span>
      <span className="complaint-hbar-value">{label(row)}</span>
      <span className="complaint-tooltip" role="tooltip"><strong>{row.industry}</strong>{tooltip(row)}</span>
    </li>;
  })}</ol>;
}

/** Superadmin: which industries subscribe, how many convert to paid, and the revenue they bring. */
export function IndustryAnalyticsSection({ data }: { data: IndustryAnalytics }) {
  const { rows, totals } = data;
  const tracked = totals.companies - totals.untracked;
  const top = rows.find((row) => row.paid > 0);
  const byRevenue = [...rows].sort((a, b) => b.mrr - a.mrr || b.paid - a.paid);
  return <section className="industry-analytics" id="analisis-bidang" aria-labelledby="industry-analytics-title">
    <div className="industry-analytics-head">
      <span className="eyebrow">Analisis data</span>
      <h2 id="industry-analytics-title">Bidang perusahaan yang berlangganan</h2>
      <p>Status langganan dihitung dari masa aktif paket saat ini. Pendapatan bulanan berasal dari harga paket berbayar yang sedang aktif.</p>
    </div>

    <div className="complaint-tiles industry-tiles">
      <article className="complaint-tile total"><span>Perusahaan berbayar aktif</span><strong>{totals.paid}</strong><small>dari {totals.companies} perusahaan terdaftar</small></article>
      <article className="complaint-tile"><span>Pendapatan bulanan</span><strong>{compactRupiah(totals.mrr)}</strong><small>{formatRupiah(totals.mrr)}</small></article>
      <article className="complaint-tile"><span>Konversi ke berbayar</span><strong>{percent(totals.paid, tracked)}%</strong><small>{totals.trial} trial · {totals.expired} habis</small></article>
      <article className="complaint-tile"><span>Bidang teratas</span><strong className="industry-tile-text">{top?.industry ?? "—"}</strong><small>{top ? `${top.paid} perusahaan berbayar` : "Belum ada yang berbayar"}</small></article>
    </div>

    <div className="complaint-chart-grid industry-chart-grid">
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">Jumlah perusahaan</span><h2>Berlangganan berbayar per bidang</h2></figcaption>
        <Bars rows={rows} value={(row) => row.paid} label={(row) => String(row.paid)} empty="Belum ada perusahaan dengan paket berbayar aktif."
          tooltip={(row) => <>{row.paid} berbayar dari {row.companies} perusahaan ({percent(row.paid, row.companies - row.untracked)}% konversi)<br />{row.trial} trial · {row.expired} habis</>} />
      </figure>
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">Pendapatan bulanan</span><h2>Kontribusi pendapatan per bidang</h2></figcaption>
        <Bars rows={byRevenue} value={(row) => row.mrr} label={(row) => compactRupiah(row.mrr)} empty="Belum ada pendapatan dari paket berbayar."
          tooltip={(row) => <>{formatRupiah(row.mrr)} / bulan<br />{percent(row.mrr, totals.mrr)}% dari total pendapatan</>} />
      </figure>
    </div>

    <div className="module-card industry-table">
      <div className="table-wrap"><table className="table">
        <caption className="sr-only">Rincian status langganan per bidang perusahaan</caption>
        <thead><tr><th>Bidang</th><th>Perusahaan</th><th>Berbayar</th><th>Trial</th><th>Habis</th><th>Tanpa data</th><th>Konversi</th><th>Karyawan aktif</th><th>Pendapatan / bulan</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.industry}>
          <td><strong>{row.industry}</strong></td>
          <td>{row.companies}</td><td>{row.paid}</td><td>{row.trial}</td><td>{row.expired}</td><td>{row.untracked}</td>
          <td>{percent(row.paid, row.companies - row.untracked)}%</td>
          <td>{row.activeEmployees.toLocaleString("id-ID")}</td>
          <td>{formatRupiah(row.mrr)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total</th><th>{totals.companies}</th><th>{totals.paid}</th><th>{totals.trial}</th><th>{totals.expired}</th><th>{totals.untracked}</th><th>{percent(totals.paid, tracked)}%</th><th>{totals.activeEmployees.toLocaleString("id-ID")}</th><th>{formatRupiah(totals.mrr)}</th></tr></tfoot>
      </table></div>
    </div>
  </section>;
}
