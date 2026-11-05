"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, TicketPercent, X } from "lucide-react";
import { formatRupiah } from "../plan-rules";

export type CouponPreviewResult = { status: "idle" | "valid" | "invalid"; message: string; discount?: number; total?: number; code?: string };
type Preview = (input: { planId: string; durationMonths: number; code: string }) => Promise<CouponPreviewResult>;

/**
 * Optional coupon entry for an invoice. Submits `couponCode` only after the code was checked
 * for the selected plan and duration; changing either clears it so the shown discount stays true.
 */
export function CouponField({ planId, durationMonths, subtotal, preview, initial, onChange }: {
  planId: string; durationMonths: number | null; subtotal: number; preview: Preview;
  /** A coupon already applied for this plan and duration (e.g. when returning to a step). */
  initial?: CouponPreviewResult | null;
  /** Called with the applied coupon, or null when it is removed or rejected. */
  onChange?: (applied: CouponPreviewResult | null) => void;
}) {
  const key = `${planId}:${durationMonths}`;
  const [code, setCode] = useState(initial?.code ?? "");
  const [result, setResult] = useState<CouponPreviewResult & { for?: string }>(initial?.status === "valid" ? { ...initial, for: key } : { status: "idle", message: "" });
  const [pending, start] = useTransition();
  const applied = result.status === "valid" && result.for === key ? result : null;

  function apply() {
    if (!durationMonths) { setResult({ status: "invalid", message: "Pilih durasi terlebih dahulu." }); return; }
    start(async () => {
      const next = await preview({ planId, durationMonths, code });
      setResult({ ...next, for: key });
      onChange?.(next.status === "valid" ? next : null);
    });
  }

  return <div className="coupon-field">
    <span className="coupon-field-label"><TicketPercent size={15} /> Kode kupon (opsional)</span>
    {applied ? <div className="coupon-applied">
      <CheckCircle2 size={16} />
      <span><span><strong>{applied.code}</strong> · hemat {formatRupiah(applied.discount ?? 0)}</span><small>Total paket {formatRupiah(applied.total ?? subtotal)} (sebelum biaya admin)</small></span>
      <button type="button" className="icon-button" aria-label="Hapus kupon" onClick={() => { setResult({ status: "idle", message: "" }); setCode(""); onChange?.(null); }}><X size={15} /></button>
      <input type="hidden" name="couponCode" value={applied.code} />
    </div> : <div className="coupon-entry">
      <input className="input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Contoh: HEMAT20" maxLength={40} aria-label="Kode kupon"
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (code.trim()) apply(); } }} />
      <button type="button" className="btn btn-outline btn-sm" disabled={pending || !code.trim()} onClick={apply}>{pending ? "Mengecek..." : "Pakai"}</button>
    </div>}
    {result.status === "invalid" ? <small className="coupon-error" role="alert">{result.message}</small> : null}
  </div>;
}
