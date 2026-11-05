"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ModalPortal } from "@/components/modal-portal";
import { createCoupon, deleteCoupon, updateCoupon, type CouponFormState } from "../server/coupon-actions";

const idle: CouponFormState = { status: "idle", message: "" };
type PlanOption = { code: string; name: string };

/** Existing coupon values for the edit form. Dates are YYYY-MM-DD in WITA. */
export type CouponDraft = {
  id: string; code: string; description: string; discountType: "percent" | "fixed"; discountValue: number;
  minDurationMonths: number; maxRedemptions: number | null; perCompanyLimit: number;
  startsAt: string; endsAt: string; planCodes: string[]; used: number;
};

export function CouponCreateButton({ plans }: { plans: PlanOption[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Buat Kupon</button>
    {open ? <ModalPortal><CouponModal plans={plans} onClose={() => setOpen(false)} /></ModalPortal> : null}
  </>;
}

export function CouponEditButton({ plans, draft }: { plans: PlanOption[]; draft: CouponDraft }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn btn-outline btn-sm" type="button" onClick={() => setOpen(true)} aria-label={`Edit kupon ${draft.code}`}><Pencil size={14} /> Edit</button>
    {open ? <ModalPortal><CouponModal plans={plans} draft={draft} onClose={() => setOpen(false)} /></ModalPortal> : null}
  </>;
}

export function CouponDeleteButton({ id, code, used }: { id: string; code: string; used: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CouponFormState>(idle);
  const [pending, start] = useTransition();
  return <>
    <button className="btn btn-outline btn-sm coupon-delete" type="button" onClick={() => { setResult(idle); setOpen(true); }} aria-label={`Hapus kupon ${code}`}><Trash2 size={14} /> Hapus</button>
    {used > 0
      ? open ? <ModalPortal><div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="coupon-used-title">
          <header><div className="confirm-icon"><AlertTriangle size={22} /></div><button type="button" aria-label="Tutup" onClick={() => setOpen(false)}><X size={18} /></button></header>
          <div><h2 id="coupon-used-title">Kupon tidak bisa dihapus</h2><p>Kupon {code} sudah dipakai di {used} invoice. Menghapusnya akan menghilangkan riwayat diskon dari laporan.</p><small>Gunakan tombol Nonaktifkan agar kupon tidak bisa dipakai lagi.</small></div>
          <footer><button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Mengerti</button></footer>
        </section>
      </div></ModalPortal> : null
      : open ? <ModalPortal><ConfirmDialog open={open} title="Hapus kupon?" busy={pending}
        message={result.status === "error" ? result.message : `Kupon ${code} akan dihapus permanen. Kupon ini belum pernah dipakai.`}
        onCancel={() => setOpen(false)}
        onConfirm={() => start(async () => {
          const next = await deleteCoupon(id);
          setResult(next);
          if (next.status === "success") { setOpen(false); router.refresh(); }
        })} /></ModalPortal> : null}
  </>;
}

function CouponModal({ plans, draft, onClose }: { plans: PlanOption[]; draft?: CouponDraft; onClose: () => void }) {
  const [state, action, pending] = useActionState(draft ? updateCoupon : createCoupon, idle);
  const [type, setType] = useState<"percent" | "fixed">(draft?.discountType ?? "percent");
  const codeLocked = Boolean(draft && draft.used > 0);
  const title = draft ? `Edit Kupon ${draft.code}` : "Buat Kupon Diskon";
  return <div className="standard-modal-overlay" onClick={onClose}>
    <div className="standard-modal-card" style={{ maxWidth: 620 }} role="dialog" aria-modal="true" aria-labelledby="coupon-title" onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><h2 id="coupon-title">{title}</h2><p>{draft ? "Perubahan berlaku untuk invoice baru. Invoice yang sudah dibuat tidak berubah." : "Kupon dipakai admin perusahaan saat membuat invoice langganan."}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      {state.status === "success" ? <>
        <div className="standard-modal-body"><p className="retention-success"><CheckCircle2 size={18} /> {state.message}</p></div>
        <footer className="standard-modal-footer"><button className="btn btn-primary" type="button" onClick={onClose}>Selesai</button></footer>
      </> : <form onSubmit={(event) => {
        // Submitted manually: a plain form action makes React reset every field after an error,
        // losing the admin's input and desyncing the discount-type select from its label.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}>
        {draft ? <input type="hidden" name="id" value={draft.id} /> : null}
        <div className="standard-modal-body coupon-form-grid">
          <label className="field"><span className="field-label">Kode kupon</span>
            <input className="input" name="code" required maxLength={30} placeholder="HEMAT20" defaultValue={draft?.code} readOnly={codeLocked} style={{ textTransform: "uppercase" }} />
            {codeLocked ? <small className="field-hint">Sudah dipakai di {draft!.used} invoice, kode tidak bisa diganti.</small> : null}
          </label>
          <label className="field"><span className="field-label">Keterangan</span><input className="input" name="description" maxLength={200} placeholder="Diskon 20% kontrak 12 bulan" defaultValue={draft?.description} /></label>
          <label className="field"><span className="field-label">Jenis diskon</span><select className="input" name="discountType" value={type} onChange={(event) => setType(event.target.value as "percent" | "fixed")}><option value="percent">Persen (%)</option><option value="fixed">Nominal (Rp)</option></select></label>
          <label className="field"><span className="field-label">Nilai diskon {type === "percent" ? "(%)" : "(Rp)"}</span><input className="input" name="discountValue" type="number" min={1} max={type === "percent" ? 100 : undefined} required placeholder={type === "percent" ? "20" : "50000"} defaultValue={draft?.discountValue} /></label>
          <label className="field"><span className="field-label">Durasi minimal</span><select className="input" name="minDurationMonths" defaultValue={String(draft?.minDurationMonths ?? 1)}>{[1, 3, 6, 8, 12].map((value) => <option key={value} value={value}>{value} bulan</option>)}</select></label>
          <label className="field"><span className="field-label">Kuota total (kosong = tanpa batas)</span><input className="input" name="maxRedemptions" type="number" min={1} placeholder="100" defaultValue={draft?.maxRedemptions ?? undefined} /></label>
          <label className="field"><span className="field-label">Batas per perusahaan</span><input className="input" name="perCompanyLimit" type="number" min={1} max={100} defaultValue={draft?.perCompanyLimit ?? 1} /></label>
          <span />
          <label className="field"><span className="field-label">Mulai berlaku (opsional)</span><input className="input" name="startsAt" type="date" defaultValue={draft?.startsAt} /></label>
          <label className="field"><span className="field-label">Berakhir (opsional, termasuk hari itu)</span><input className="input" name="endsAt" type="date" defaultValue={draft?.endsAt} /></label>
          <fieldset className="coupon-plans"><legend className="field-label">Berlaku untuk paket (kosong = semua paket berbayar)</legend>
            {plans.map((plan) => <label key={plan.code}><input type="checkbox" name="planCodes" value={plan.code} defaultChecked={draft?.planCodes.includes(plan.code)} /> {plan.name}</label>)}
          </fieldset>
          {state.status === "error" ? <div className="plan-inline-error coupon-form-error" role="alert"><AlertTriangle size={18} /><span><strong>Gagal</strong><small>{state.message}</small></span></div> : null}
        </div>
        <footer className="standard-modal-footer"><button className="btn btn-outline" type="button" onClick={onClose}>Batal</button><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Menyimpan..." : draft ? "Simpan Perubahan" : "Simpan Kupon"}</button></footer>
      </form>}
    </div>
  </div>;
}
