import { getTrialFunnel } from "../server/trial-funnel";
import { HorizontalBars, percent, VerticalBars } from "../components/report-charts";

export async function TrialFunnelPage() {
  const funnel = await getTrialFunnel();
  const { totals, trialDays } = funnel;
  const conversion = percent(totals.paidFromTrial, totals.trialsDecided);
  const paidCount = funnel.timeToPay.reduce((sum, row) => sum + row.count, 0);
  const withinTrial = funnel.timeToPay[0]?.count ?? 0;
  const lateShare = percent(paidCount - withinTrial, paidCount);
  const steps = [
    { key: "registered", label: "Mendaftar", value: totals.registered },
    { key: "trial", label: "Memulai trial", value: totals.trialStarted },
    { key: "paid", label: "Membayar", value: totals.paid },
    { key: "active", label: "Masih berbayar", value: totals.paidActive },
  ];
  // A plain-language reading of whether the trial length fits.
  const verdict = paidCount < 5
    ? "Data pembayaran masih sedikit, sehingga belum cukup untuk menilai panjang trial."
    : lateShare >= 40
      ? `${lateShare}% perusahaan baru membayar setelah trial ${trialDays} hari selesai. Pertimbangkan trial yang lebih panjang atau follow-up di akhir trial.`
      : `${100 - lateShare}% perusahaan yang membayar sudah memutuskan dalam ${trialDays} hari. Panjang trial saat ini tampak cukup.`;

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Konversi Trial</span><h1>KONVERSI TRIAL KE BERBAYAR</h1><p>Perusahaan yang mendaftar dalam 12 bulan terakhir, dikelompokkan menurut bulan pendaftaran. Masa Free Trial saat ini {trialDays} hari.</p></div></header>

    <section className="complaint-tiles industry-tiles">
      <article className="complaint-tile total"><span>Konversi trial</span><strong>{conversion}%</strong><small>{totals.paidFromTrial} dari {totals.trialsDecided} trial yang sudah selesai</small></article>
      <article className="complaint-tile"><span>Masih trial</span><strong>{totals.stillTrial}</strong><small>Belum memutuskan</small></article>
      <article className="complaint-tile"><span>Berhenti tanpa bayar</span><strong>{totals.stoppedWithoutPaying}</strong><small>{percent(totals.stoppedWithoutPaying, totals.registered)}% dari pendaftar</small></article>
      <article className="complaint-tile"><span>Median sampai bayar</span><strong>{funnel.medianDaysToPay === null ? "—" : `${funnel.medianDaysToPay} hari`}</strong><small>Sejak mendaftar</small></article>
    </section>

    <p className="report-verdict" role="note">{verdict}</p>

    <div className="complaint-chart-grid industry-chart-grid">
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">Funnel 12 bulan</span><h2>Dari daftar sampai berbayar</h2></figcaption>
        <HorizontalBars empty="Belum ada pendaftaran dalam 12 bulan terakhir." data={steps.map((step) => ({ key: step.key, label: step.label, value: step.value, display: String(step.value), tooltip: <>{step.value} perusahaan<br />{percent(step.value, totals.registered)}% dari pendaftar</> }))} />
      </figure>
      <figure className="module-card complaint-chart">
        <figcaption><span className="eyebrow">Waktu memutuskan</span><h2>Lama sampai pembayaran pertama</h2></figcaption>
        <HorizontalBars empty="Belum ada perusahaan yang membayar." data={funnel.timeToPay.map((row) => ({ key: row.label, label: row.label, value: row.count, display: String(row.count), tooltip: <>{row.count} perusahaan<br />{percent(row.count, paidCount)}% dari yang membayar</> }))} />
      </figure>
    </div>

    <figure className="module-card complaint-chart">
      <figcaption><span className="eyebrow">Per bulan pendaftaran</span><h2>Tingkat konversi trial</h2></figcaption>
      <VerticalBars highlight={funnel.cohorts[11]?.key} data={funnel.cohorts.map((row) => ({ key: row.key, label: row.label, value: percent(row.paidFromTrial, row.trialsDecided), display: row.trialsDecided ? `${percent(row.paidFromTrial, row.trialsDecided)}%` : "", tooltip: row.trialsDecided ? <>{row.paidFromTrial} dari {row.trialsDecided} trial selesai membayar<br />{row.stillTrial} masih trial</> : <>Belum ada trial yang selesai<br />{row.registered} pendaftar</> }))} />
    </figure>

    <section className="module-card industry-table">
      <div className="report-table-head"><h2>Rincian per bulan pendaftaran</h2><p>Konversi hanya dihitung dari trial yang sudah selesai, agar bulan terbaru tidak terlihat rendah karena masih berjalan.</p></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Bulan daftar</th><th>Mendaftar</th><th>Mulai trial</th><th>Membayar</th><th>Masih trial</th><th>Berhenti tanpa bayar</th><th>Berhenti setelah bayar</th><th>Konversi trial</th></tr></thead>
        <tbody>{[...funnel.cohorts].reverse().map((row) => <tr key={row.key}>
          <td><strong>{row.label}</strong></td><td>{row.registered}</td><td>{row.trialStarted}</td><td>{row.paid}</td><td>{row.stillTrial}</td><td>{row.stoppedWithoutPaying}</td><td>{row.stoppedAfterPaying}</td>
          <td>{row.trialsDecided ? `${percent(row.paidFromTrial, row.trialsDecided)}%` : "—"}</td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total</th><th>{totals.registered}</th><th>{totals.trialStarted}</th><th>{totals.paid}</th><th>{totals.stillTrial}</th><th>{totals.stoppedWithoutPaying}</th><th>{totals.stoppedAfterPaying}</th><th>{conversion}%</th></tr></tfoot>
      </table></div>
    </section>
  </>;
}
