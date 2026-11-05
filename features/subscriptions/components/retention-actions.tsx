"use client";

import { createContext, useActionState, useContext, useState, useTransition } from "react";
import { AlertTriangle, CalendarPlus, MailCheck, Send, X } from "lucide-react";
import { formatRupiah } from "../plan-rules";
import { extendSubscriptionManually, runRemindersNow, type ManualExtendState } from "../server/superadmin-actions";
import type { ReminderRunResult } from "../server/reminders";

export type ExtendPlanOption = { id: string; name: string; monthlyPrice: number; maxEmployees: number; companyId: string | null };
const idle: ManualExtendState = { status: "idle", message: "" };

function ExtendModal({ company, plans, defaultPlanId, onClose }: { company: { id: string; name: string }; plans: ExtendPlanOption[]; defaultPlanId: string | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(extendSubscriptionManually, idle);
  const options = plans.filter((plan) => plan.companyId === null || plan.companyId === company.id);
  const [planId, setPlanId] = useState(defaultPlanId && options.some((plan) => plan.id === defaultPlanId) ? defaultPlanId : options.find((plan) => plan.monthlyPrice > 0)?.id ?? options[0]?.id ?? "");
  const [months, setMonths] = useState(1);
  const plan = options.find((item) => item.id === planId);
  return <div className="standard-modal-overlay" onClick={onClose}>
    <div className="standard-modal-card" style={{ maxWidth: 520 }} role="dialog" aria-modal="true" aria-labelledby="extend-title" onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><h2 id="extend-title">Perpanjang Manual</h2><p>{company.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      {state.status === "success" ? <>
        <div className="standard-modal-body"><p className="retention-success"><MailCheck size={18} /> {state.message}</p></div>
        <footer className="standard-modal-footer"><button className="btn btn-primary" type="button" onClick={onClose}>Selesai</button></footer>
      </> : <form action={action}>
        <div className="standard-modal-body">
          <input type="hidden" name="companyId" value={company.id} />
          <label className="field"><span className="field-label">Paket</span><select className="input" name="planId" value={planId} onChange={(event) => setPlanId(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.monthlyPrice ? `${formatRupiah(item.monthlyPrice)}/bln` : "Gratis"} · {item.maxEmployees.toLocaleString("id-ID")} karyawan</option>)}</select></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field"><span className="field-label">Durasi</span><select className="input" name="months" value={months} onChange={(event) => setMonths(Number(event.target.value))}>{[1, 3, 6, 12].map((value) => <option key={value} value={value}>{value} Bulan</option>)}</select></label>
            <label className="field"><span className="field-label">Nominal diterima (Rp)</span><input className="input" name="amount" type="number" min={0} step={1000} placeholder="0 = gratis / kompensasi" defaultValue={plan ? plan.monthlyPrice * months : 0} key={`${planId}-${months}`} /></label>
          </div>
          <p className="retention-hint">Jika paket yang sama masih berjalan, masa aktif disambung dari tanggal berakhirnya. Paket berbeda langsung menggantikan paket lama. Nominal di atas 0 tercatat sebagai pendapatan dengan metode “Manual”.</p>
          {state.status === "error" ? <div className="plan-inline-error" role="alert"><AlertTriangle size={18} /><span><strong>Gagal</strong><small>{state.message}</small></span></div> : null}
        </div>
        <footer className="standard-modal-footer"><button className="btn btn-outline" type="button" onClick={onClose}>Batal</button><button className="btn btn-primary" type="submit" disabled={pending || !planId}>{pending ? "Menyimpan..." : "Aktifkan"}</button></footer>
      </form>}
    </div>
  </div>;
}

type ExtendTarget = { company: { id: string; name: string }; defaultPlanId: string | null };
const ExtendDialogContext = createContext<(target: ExtendTarget) => void>(() => {});

/**
 * Owns the extend dialog outside the table rows: after a successful extension the company moves to
 * another tab and its row unmounts, but the dialog (and its success message) stays on screen.
 */
export function ExtendDialogProvider({ plans, children }: { plans: ExtendPlanOption[]; children: React.ReactNode }) {
  const [target, setTarget] = useState<ExtendTarget | null>(null);
  return <ExtendDialogContext.Provider value={setTarget}>
    {children}
    {target ? <ExtendModal key={target.company.id} company={target.company} plans={plans} defaultPlanId={target.defaultPlanId} onClose={() => setTarget(null)} /> : null}
  </ExtendDialogContext.Provider>;
}

export function ExtendButton({ company, defaultPlanId }: ExtendTarget) {
  const open = useContext(ExtendDialogContext);
  return <button className="btn btn-primary btn-sm" type="button" onClick={() => open({ company, defaultPlanId })}><CalendarPlus size={14} /> Perpanjang manual</button>;
}

export function RunRemindersButton({ mailReady }: { mailReady: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReminderRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return <div className="retention-run">
    <button className="btn btn-outline btn-sm" type="button" disabled={pending || !mailReady} onClick={() => start(async () => {
      setError(null);
      try { setResult(await runRemindersNow()); } catch (caught) { setError(caught instanceof Error ? caught.message : "Gagal menjalankan pengingat."); }
    })}><Send size={14} /> {pending ? "Mengirim..." : "Kirim pengingat yang jatuh tempo"}</button>
    {result ? <span className="retention-run-result" role="status">Diperiksa {result.checked} · terkirim {result.sent} · gagal {result.failed} · dilewati {result.skipped}{result.messages.length ? ` — ${result.messages.slice(0, 2).join("; ")}` : ""}</span> : null}
    {error ? <span className="retention-run-result error" role="alert">{error}</span> : null}
  </div>;
}
