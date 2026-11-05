"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, PackageCheck, Users, X } from "lucide-react";
import { previewCoupon, requestSubscription, type ActionState } from "../actions";
import { CouponField } from "@/features/subscriptions/components/coupon-field";
import { pricePerEmployee, trialLabel } from "@/features/subscriptions/plan-rules";

type Plan = { id: string; code: string; name: string; monthlyPrice: number; maxEmployees: number; description: string; trialMonths: number; trialDays: number; recommended: boolean };
const idle: ActionState = { status: "idle", message: "" };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function PlanRequestModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(requestSubscription, idle);
  useEffect(() => {
    if (state.status === "success") router.push(`/dashboard/langganan?invoice=${state.orderId ?? ""}`);
  }, [router, state]);
  const isDemo = plan.monthlyPrice === 0;
  const [months, setMonths] = useState<number | null>(null);
  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog duration-dialog plan-duration-dialog" role="dialog" aria-modal="true" aria-labelledby="choose-plan-title">
      <header><span className="plan-dialog-title-icon"><CalendarDays size={18} /></span><div><small>LANGGANAN TEPATWAKTU</small><h2 id="choose-plan-title">Pilih Durasi {isDemo ? "Paket Demo" : `Paket ${plan.name}`}</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><X size={19} /></button></header>
      <form action={action}>
        <div className="plan-request-summary"><span><PackageCheck size={19} /><small>Paket dipilih</small><strong>{plan.name}</strong></span><span><Users size={19} /><small>Kapasitas</small><strong>{plan.maxEmployees} Karyawan</strong></span><span><small>Harga mulai</small><strong>{money(plan.monthlyPrice)}<b>/bulan</b></strong></span></div>
        <div className="subscription-dialog-body"><p>Tentukan masa aktif paket perusahaan Anda.</p><label className="plan-duration-field"><span>Durasi masa aktif</span><select name="durationMonths" defaultValue={isDemo ? "1" : ""} disabled={isDemo} required onChange={(event) => setMonths(Number(event.target.value) || null)}>{isDemo ? <option value="1">{trialLabel(plan) ?? "1 bulan"}</option> : <><option value="" disabled>Pilih durasi paket</option><option value="1">1 Bulan</option><option value="3">3 Bulan</option><option value="6">6 Bulan</option><option value="8">8 Bulan</option><option value="12">12 Bulan</option></>}</select></label>{isDemo && <input type="hidden" name="durationMonths" value="1" />}<input type="hidden" name="planId" value={plan.id} />
          {!isDemo && <CouponField planId={plan.id} durationMonths={months} subtotal={plan.monthlyPrice * (months ?? 1)} preview={previewCoupon} />}
          {state.status === "error" && <div className="plan-inline-error" role="alert"><AlertTriangle size={18} /><span><strong>Pengajuan gagal</strong><small>{state.message}</small></span></div>}
        </div>
        <footer><button type="button" className="plan-dialog-cancel" onClick={onClose}>Batal</button><button className="subscription-blue-button" type="submit" disabled={pending}>{pending ? "MEMPROSES..." : isDemo ? "AKTIFKAN PAKET" : "LANJUTKAN"}</button></footer>
      </form>
    </section>
  </div>;
}

export function PlanSelector({ plans, currentPlanCode, canManage, initialPlanId, children }: { plans: Plan[]; currentPlanCode: string; canManage: boolean; initialPlanId?: string; children?: React.ReactNode }) {
  const [selected, setSelected] = useState<Plan | null>(() => plans.find((plan) => plan.id === initialPlanId) ?? null);
  return <><div className="subscription-plan-reference-grid">{plans.map((plan) => {
    const current = plan.code === currentPlanCode;
    const demo = plan.monthlyPrice === 0;
    return <article className="subscription-plan-reference" key={plan.id}>
      <header><PackageCheck size={23} /><strong>PAKET {plan.name.toUpperCase()}</strong>{plan.recommended && <span>REKOMENDASI</span>}</header>
      <div><h2>{money(plan.monthlyPrice)}<small>/ bulan</small></h2><button type="button" className={demo ? "primary" : ""} disabled={!canManage || current} onClick={() => setSelected(plan)}>{current ? "Paket Saat Ini" : canManage ? "Pilih Paket" : "Hubungi Admin"}</button><label>APA YANG ANDA PEROLEH</label><ul>{demo && <li><CheckCircle2 size={14} />Gratis selama {trialLabel(plan) ?? "1 bulan"}</li>}<li><CheckCircle2 size={14} />Maksimal {plan.maxEmployees.toLocaleString("id-ID")} karyawan</li>{!demo && <li><CheckCircle2 size={14} />{money(pricePerEmployee(plan))} per karyawan</li>}<li><CheckCircle2 size={14} />{plan.description}</li></ul></div>
    </article>;
  })}{children}</div>{selected && <PlanRequestModal plan={selected} onClose={() => setSelected(null)} />}</>;
}
