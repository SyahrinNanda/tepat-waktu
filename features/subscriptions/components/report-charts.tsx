/** Single-series bar charts for superadmin reports. Values are direct-labeled; a table accompanies each. */

export type BarDatum = { key: string; label: string; value: number; display: string; tooltip: React.ReactNode };

export function HorizontalBars({ data, empty }: { data: BarDatum[]; empty: string }) {
  const max = Math.max(0, ...data.map((item) => item.value));
  if (!max) return <p className="complaint-chart-empty">{empty}</p>;
  return <ol className="complaint-hbars industry-hbars">{data.map((item) => <li key={item.key} tabIndex={0} aria-label={`${item.label}: ${item.display}`}>
    <span className="complaint-hbar-label">{item.label}</span>
    <span className="complaint-hbar-track"><span className="complaint-hbar-fill" style={{ width: `${item.value ? Math.max(item.value / max * 100, 2) : 0}%` }} /></span>
    <span className="complaint-hbar-value">{item.display}</span>
    <span className="complaint-tooltip" role="tooltip"><strong>{item.label}</strong>{item.tooltip}</span>
  </li>)}</ol>;
}

/** Column chart; `highlight` marks the current period with the darker step. */
export function VerticalBars({ data, highlight }: { data: BarDatum[]; highlight?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <div className="complaint-vbars report-vbars" role="list">{data.map((item) => <div className={`complaint-vbar ${item.key === highlight ? "is-current" : ""}`} role="listitem" key={item.key} tabIndex={0} aria-label={`${item.label}: ${item.display}`}>
    <span className="complaint-vbar-col"><span className="complaint-vbar-value">{item.value ? item.display : ""}</span><span className="complaint-vbar-fill" style={{ height: `${item.value ? Math.max(item.value / max * 88, 3) : 0}%` }} /></span>
    <span className="complaint-vbar-label">{item.label}</span>
    <span className="complaint-tooltip" role="tooltip"><strong>{item.label}</strong>{item.tooltip}</span>
  </div>)}</div>;
}

export const compactRupiah = (value: number) => value === 0 ? "Rp 0" : `Rp ${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
export const percent = (part: number, whole: number) => whole ? Math.round(part / whole * 100) : 0;
