import { categoryLabels, statusKeys, statusLabels, statusTone } from "../config";
import type { ComplaintStats } from "../server/complaint-service";

/** Status tiles + two single-series bar charts (category frequency, six-month trend). Values are direct-labeled. */
export function ComplaintCharts({ stats }: { stats: ComplaintStats }) {
  const maxCategory = Math.max(1, ...stats.byCategory.map((item) => item.count));
  const maxMonth = Math.max(1, ...stats.byMonth.map((item) => item.count));
  const open = stats.byStatus.new + stats.byStatus.reviewing + stats.byStatus.in_progress;
  return <>
    <section className="complaint-tiles" aria-label="Ringkasan status laporan">
      <article className="complaint-tile total"><span>Total laporan</span><strong>{stats.total}</strong><small>{open} masih terbuka</small></article>
      {statusKeys.map((key) => <article className="complaint-tile" key={key}><span><i className={`complaint-dot ${statusTone[key]}`}/>{statusLabels[key]}</span><strong>{stats.byStatus[key]}</strong></article>)}
    </section>
    <section className="complaint-chart-grid">
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">Paling sering dilaporkan</span><h2>Laporan per jenis keluhan</h2></figcaption>
        {stats.byCategory.length ? <ol className="complaint-hbars">{stats.byCategory.map((item) => {
          const share = stats.total ? Math.round(item.count / stats.total * 100) : 0;
          return <li key={item.category} tabIndex={0} aria-label={`${categoryLabels[item.category]}: ${item.count} laporan, ${share}%`}>
            <span className="complaint-hbar-label">{categoryLabels[item.category]}</span>
            <span className="complaint-hbar-track"><span className="complaint-hbar-fill" style={{ width: `${Math.max(item.count / maxCategory * 100, 2)}%` }}/></span>
            <span className="complaint-hbar-value">{item.count}</span>
            <span className="complaint-tooltip" role="tooltip"><strong>{categoryLabels[item.category]}</strong>{item.count} laporan · {share}% dari total</span>
          </li>;
        })}</ol> : <p className="complaint-chart-empty">Belum ada laporan.</p>}
      </figure>
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">6 bulan terakhir</span><h2>Tren laporan masuk</h2></figcaption>
        <div className="complaint-vbars" role="list">{stats.byMonth.map((item) => <div className="complaint-vbar" role="listitem" key={item.key} tabIndex={0} aria-label={`${item.label}: ${item.count} laporan`}>
          <span className="complaint-vbar-col"><span className="complaint-vbar-value">{item.count}</span><span className="complaint-vbar-fill" style={{ height: `${item.count ? Math.max(item.count / maxMonth * 88, 4) : 0}%` }}/></span>
          <span className="complaint-vbar-label">{item.label}</span>
          <span className="complaint-tooltip" role="tooltip"><strong>{item.label}</strong>{item.count} laporan masuk</span>
        </div>)}</div>
      </figure>
    </section>
  </>;
}
