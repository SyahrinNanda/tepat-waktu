"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Check, Clapperboard, Crown, Landmark, Laptop, LoaderCircle, MailCheck, Shapes, Ticket, UtensilsCrossed, Wrench } from "lucide-react";
import { FormEvent, useState } from "react";
import { CUSTOM_MIN_EMPLOYEES, CUSTOM_PRICE_FLOOR, DURATION_OPTIONS, pricePerEmployee, trialLabel } from "@/features/subscriptions/plan-rules";
import { CouponField, type CouponPreviewResult } from "@/features/subscriptions/components/coupon-field";
import { previewRegistrationCoupon } from "@/features/subscriptions/server/registration-coupon";

export type RegistrationPlan = { code: string; name: string; monthlyPrice: number; maxEmployees: number; description: string; trialMonths: number; trialDays: number; recommended: boolean };
const industries = [
  ["Teknologi", Laptop, "Software house, startup, IT & telekomunikasi"],
  ["Pemerintahan", Landmark, "Instansi, dinas, BUMN & BUMD"],
  ["F&B", UtensilsCrossed, "Restoran, kafe, katering & dapur produksi"],
  ["Jasa", Wrench, "Konsultan, klinik, bengkel & layanan lapangan"],
  ["Media", Clapperboard, "Agensi, studio kreatif, penerbitan & penyiaran"],
  ["Lainnya", Shapes, "Retail, manufaktur, pendidikan & bidang lain"],
] as const;
const stepNames = ["Pilih Bidang", "Pilih Paket", "Daftar Akun", "Finish"];
const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export function RegistrationFlow({ plans }: { plans: RegistrationPlan[] }) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [durationMonths, setDurationMonths] = useState(1);
  const [coupon, setCoupon] = useState<CouponPreviewResult | null>(null);
  const plan = plans.find((item) => item.code === planCode);
  const isPaid = Boolean(plan && plan.monthlyPrice > 0);
  const months = isPaid ? durationMonths : 1;
  const subtotal = plan ? plan.monthlyPrice * months : 0;
  const discount = isPaid && coupon?.status === "valid" ? coupon.discount ?? 0 : 0;
  const total = subtotal - discount;
  const choosePlan = (code: string) => { setPlanCode(code); setCoupon(null); setShowPlans(false); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const data = { email: String(form.get("email") || "").trim().toLowerCase(), password: String(form.get("password") || "") };
    // Re-validated on the server and stored until the email is verified.
    const metadata = { industry, plan: planCode, companyName: String(form.get("companyName") || "").trim(), name: String(form.get("name") || "").trim(), ...(isPaid ? { durationMonths: months, ...(coupon?.code ? { couponCode: coupon.code } : {}) } : {}) };
    try {
      const response = await fetch("/api/registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...metadata, ...data }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.message || "Akun belum berhasil dibuat. Silakan coba lagi."); return; }
      setRegisteredEmail(result.email || data.email);
      setStep(4);
    } catch { setError("Tidak dapat menghubungi server. Silakan coba lagi."); }
    finally { setLoading(false); }
  }

  return <div className="registration-page">
    <header className="registration-header"><div className="registration-header-inner"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><nav className="registration-steps" aria-label="Tahap pendaftaran">{stepNames.map((name, index) => <div className={`registration-step ${step >= index + 1 ? "is-active" : ""}`} key={name}><span>{index + 1}</span><small>{name}</small></div>)}</nav></div></header>
    <main className={`registration-main ${showPlans && step === 2 ? "plans-open" : ""}`}>
      {step === 1 && <section className="industry-split">
        <aside className="industry-intro">
          <span className="industry-eyebrow">Langkah 1 dari 3</span>
          <h1>Bidang usaha perusahaan Anda?</h1>
          <p>Informasi bidang perusahaan membantu kami memberikan fitur yang lebih relevan untuk bisnis Anda.</p>
          <ul className="industry-perks">
            <li><Check size={15}/> Bisa diubah nanti di Pengaturan → Profil</li>
            <li><Check size={15}/> Tidak memengaruhi harga paket</li>
          </ul>
          <div className={`industry-picked ${industry ? "has-value" : ""}`}>{industry ? <>Dipilih: <strong>{industry}</strong></> : "Belum ada bidang dipilih"}</div>
        </aside>
        <div className="industry-panel">
          <div className="industry-list" role="radiogroup" aria-label="Bidang perusahaan">{industries.map(([name, Icon, hint]) => <button key={name} type="button" role="radio" aria-checked={industry === name} className={`industry-row ${industry === name ? "is-selected" : ""}`} onClick={() => setIndustry(name)}><span className="industry-row-icon"><Icon size={22} strokeWidth={1.8}/></span><span className="industry-row-text"><strong>{name}</strong><small>{hint}</small></span><span className="industry-row-radio" aria-hidden="true">{industry === name && <Check size={13} strokeWidth={3}/>}</span></button>)}</div>
          <div className="registration-actions industry-actions"><Link href="/" className="btn btn-outline"><ArrowLeft size={16}/> Kembali ke login</Link><button className="btn btn-primary" type="button" disabled={!industry} onClick={() => setStep(2)}>Lanjutkan <ArrowRight size={16}/></button></div>
        </div>
      </section>}
      {step === 2 && <div className="registration-plan-area">{showPlans ? <><button className="btn btn-outline" type="button" onClick={() => setShowPlans(false)}><ArrowLeft size={16}/> Kembali</button><h1>Pilih Paket TepatWaktu</h1><div className="registration-plans-grid">{plans.map((item) => <article className={`registration-plan-card ${planCode === item.code ? "selected" : ""} ${item.recommended ? "is-recommended" : ""}`} key={item.code}><div className="registration-plan-name"><span className="registration-plan-icon">{item.recommended ? <Crown size={15}/> : <Ticket size={15}/>}</span> Paket {item.name} {item.recommended && <em>REKOMENDASI</em>}</div><div className="registration-plan-content"><div className="registration-plan-price">{rupiah(item.monthlyPrice)} <small>/ bulan</small></div><button type="button" className={`btn ${planCode === item.code ? "btn-primary" : "btn-outline"} btn-block`} onClick={() => choosePlan(item.code)}>{planCode === item.code ? "Paket dipilih" : "Pilih Paket"}</button><p>APA YANG ANDA PEROLEH</p><ul><li><Check size={15}/> Maksimal {item.maxEmployees.toLocaleString("id-ID")} karyawan</li>{trialLabel(item) && <li><Check size={15}/> Gratis selama {trialLabel(item)}</li>}{item.monthlyPrice > 0 && <li><Check size={15}/> {rupiah(pricePerEmployee(item))} per karyawan</li>}<li><Check size={15}/> {item.description}</li></ul></div></article>)}<article className="registration-plan-card is-custom"><div className="registration-plan-name"><span className="registration-plan-icon"><Building2 size={15}/></span> Paket Custom <em>NEGO</em></div><div className="registration-plan-content"><div className="registration-plan-price">{rupiah(CUSTOM_PRICE_FLOOR)} <small>/ karyawan</small></div>{plans.some((item) => item.monthlyPrice === 0) && <button type="button" className="btn btn-outline btn-block" onClick={() => { const trial = plans.find((item) => item.monthlyPrice === 0); if (trial) choosePlan(trial.code); }}>Mulai dengan Free Trial</button>}<p>UNTUK LEBIH DARI {(CUSTOM_MIN_EMPLOYEES - 1).toLocaleString("id-ID")} KARYAWAN</p><ul><li><Check size={15}/> Harga per karyawan bisa dinegosiasikan</li><li><Check size={15}/> Daftar dengan Free Trial, lalu ajukan dari menu Langganan → Daftar Paket</li></ul></div></article></div></> : <section className="registration-card plan-summary"><h1>Pilih Paket</h1><div className="registration-card-body"><p>{plan ? `Paket ${plan.name}` : "Belum ada paket dipilih"}</p><button type="button" className="registration-all-plans" onClick={() => setShowPlans(true)}>Lihat Semua Paket <ArrowRight size={16}/></button><div className="registration-price-row"><span>Harga per bulan</span><strong>{plan ? rupiah(plan.monthlyPrice) : "—"}</strong></div><div className="registration-price-row"><span>Jumlah karyawan</span><strong>{plan ? `${plan.maxEmployees} orang` : "—"}</strong></div>{isPaid && plan && <>
        <label className="registration-price-row registration-duration"><span>Durasi langganan</span><select className="input" value={durationMonths} onChange={(event) => { setDurationMonths(Number(event.target.value)); setCoupon(null); }}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value} bulan</option>)}</select></label>
        <CouponField key={`${plan.code}:${durationMonths}`} planId={plan.code} durationMonths={durationMonths} subtotal={subtotal} initial={coupon} onChange={setCoupon}
          preview={({ planId, durationMonths: duration, code }) => previewRegistrationCoupon({ planCode: planId, durationMonths: duration, code })} />
        {discount > 0 && <><div className="registration-price-row"><span>Subtotal ({months} bulan)</span><strong>{rupiah(subtotal)}</strong></div><div className="registration-price-row registration-discount"><span>Diskon kupon {coupon?.code}</span><strong>− {rupiah(discount)}</strong></div></>}
      </>}<div className="registration-price-row total"><span>Total{isPaid ? ` ${months} bulan` : ""}</span><strong>{plan ? rupiah(total) : "—"}</strong></div>{isPaid && <p className="registration-price-note">{total === 0 ? "Paket langsung aktif setelah akun diverifikasi." : "Belum termasuk biaya admin metode pembayaran. Selama menunggu pembayaran, Anda memakai Free Trial."}</p>}<button type="button" className="btn btn-primary btn-block" disabled={!plan} onClick={() => setStep(3)}>Daftar Akun Sekarang <ArrowRight size={16}/></button><button type="button" className="registration-text-button" onClick={() => setStep(1)}>Ubah bidang perusahaan</button></div></section>}<p className="registration-terms">Dengan mendaftar, Anda menyetujui Syarat dan Ketentuan serta Kebijakan Privasi TepatWaktu.</p></div>}
      {step === 3 && <section className="registration-card account-card"><h1>Daftar Akun</h1><form className="registration-card-body" onSubmit={submit}>{error && <div className="error-box" role="alert">{error}</div>}<p>Isi data perusahaan dan administrator. Tautan aktivasi akan dikirim ke email Anda.</p><div className="registration-account-grid"><div className="field"><label htmlFor="companyName">Nama perusahaan</label><input className="input" id="companyName" name="companyName" placeholder="PT Contoh Indonesia" required minLength={2}/></div><div className="field"><label htmlFor="name">Nama lengkap administrator</label><input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" required minLength={2}/></div><div className="field"><label htmlFor="email">Email kerja</label><input className="input" id="email" name="email" type="email" placeholder="anda@perusahaan.com" autoComplete="email" required/></div><div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" placeholder="Minimal 8 karakter" minLength={8} maxLength={128} autoComplete="new-password" required/></div></div><div className="registration-selected-plan"><span className="registration-plan-icon"><Ticket size={16}/></span><span>Paket terpilih<strong>{plan?.name} · {isPaid ? `${months} bulan · ${rupiah(total)}` : plan ? rupiah(plan.monthlyPrice) : "—"}</strong>{discount > 0 && <small className="registration-coupon-note">Kupon {coupon?.code} · hemat {rupiah(discount)}</small>}</span><button type="button" className="registration-text-button" onClick={() => setStep(2)}>Ubah</button></div><div className="registration-actions"><button className="btn btn-outline" type="button" onClick={() => setStep(2)}><ArrowLeft size={16}/> Kembali</button><button className="btn btn-primary" disabled={loading}>{loading ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {loading ? "Mendaftarkan..." : "Buat akun"}</button></div></form></section>}
      {step === 4 && <section className="registration-card registration-finish"><div className="registration-card-body"><span className="registration-finish-icon"><MailCheck size={38}/></span><h1>Periksa email Anda</h1><p>Tautan verifikasi telah dikirim ke <strong>{registeredEmail}</strong>. Buka email dan klik tautannya untuk mengaktifkan akun dan membuat ruang kerja perusahaan.</p><Link className="btn btn-primary" href={`/verifikasi-email?email=${encodeURIComponent(registeredEmail)}`}>Lihat petunjuk verifikasi <ArrowRight size={16}/></Link></div></section>}
    </main><footer className="registration-footer">© {new Date().getFullYear()} TepatWaktu</footer>
  </div>;
}
