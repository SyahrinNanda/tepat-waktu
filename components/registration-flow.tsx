"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";

export type RegistrationPlan = { code: string; name: string; monthlyPrice: number; maxEmployees: number; description: string; trialMonths: number; recommended: boolean };
const industries = [["Teknologi", "💻"], ["Pemerintahan", "🏛️"], ["F&B", "🍽️"], ["Jasa", "🔧"], ["Media", "🎬"], ["Lainnya", "✏️"]] as const;
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
  const [emailSent, setEmailSent] = useState(true);
  const [emailError, setEmailError] = useState("");
  const plan = plans.find((item) => item.code === planCode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const data = { industry, plan: planCode, companyName: String(form.get("companyName") || "").trim(), name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), password: String(form.get("password") || "") };
    try {
      const response = await fetch("/api/registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setError(result.message || "Pendaftaran belum berhasil."); return; }
      setRegisteredEmail(data.email);
      setEmailSent(result.emailSent !== false);
      setEmailError(result.emailError || "");
      setStep(4);
    } catch { setError("Tidak dapat menghubungi server. Silakan coba lagi."); }
    finally { setLoading(false); }
  }

  return <div className="registration-page">
    <header className="registration-header"><div className="registration-header-inner"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><nav className="registration-steps" aria-label="Tahap pendaftaran">{stepNames.map((name, index) => <div className={`registration-step ${step >= index + 1 ? "is-active" : ""}`} key={name}><span>{index + 1}</span><small>{name}</small></div>)}</nav></div></header>
    <main className={`registration-main ${showPlans && step === 2 ? "plans-open" : ""}`}>
      {step === 1 && <section className="registration-card industry-card"><h1>Pilih Bidang Perusahaan</h1><div className="registration-card-body"><div className="industry-grid">{industries.map(([name, icon]) => <button key={name} type="button" className={`industry-option ${industry === name ? "is-selected" : ""}`} onClick={() => setIndustry(name)} aria-pressed={industry === name}><span>{icon}</span><strong>{name}</strong></button>)}</div><p>Informasi bidang perusahaan membantu kami memberikan fitur yang lebih relevan untuk bisnis Anda.</p><div className="registration-actions"><Link href="/" className="btn btn-outline"><ArrowLeft size={16}/> Kembali ke login</Link><button className="btn btn-primary" type="button" disabled={!industry} onClick={() => setStep(2)}>Lanjutkan <ArrowRight size={16}/></button></div></div></section>}
      {step === 2 && <div className="registration-plan-area">{showPlans ? <><button className="btn btn-outline" type="button" onClick={() => setShowPlans(false)}><ArrowLeft size={16}/> Kembali</button><h1>Pilih Paket TepatWaktu</h1><div className="registration-plans-grid">{plans.map((item) => <article className={`registration-plan-card ${planCode === item.code ? "selected" : ""}`} key={item.code}><div className="registration-plan-name">🎟️ Paket {item.name} {item.recommended && <em>REKOMENDASI</em>}</div><div className="registration-plan-content"><div className="registration-plan-price">{rupiah(item.monthlyPrice)} <small>/ bulan</small></div><button type="button" className={`btn ${planCode === item.code ? "btn-primary" : "btn-outline"} btn-block`} onClick={() => { setPlanCode(item.code); setShowPlans(false); }}>{planCode === item.code ? "Paket dipilih" : "Pilih Paket"}</button><p>APA YANG ANDA PEROLEH</p><ul><li><Check size={15}/> Maksimal {item.maxEmployees} karyawan</li>{item.trialMonths > 0 && <li><Check size={15}/> Gratis selama {item.trialMonths} bulan</li>}<li><Check size={15}/> {item.description}</li></ul></div></article>)}</div></> : <section className="registration-card plan-summary"><h1>Pilih Paket</h1><div className="registration-card-body"><p>{plan ? `Paket ${plan.name}` : "Belum ada paket dipilih"}</p><button type="button" className="registration-all-plans" onClick={() => setShowPlans(true)}>Lihat Semua Paket <ArrowRight size={16}/></button><div className="registration-price-row"><span>Harga per bulan</span><strong>{plan ? rupiah(plan.monthlyPrice) : "—"}</strong></div><div className="registration-price-row"><span>Jumlah karyawan</span><strong>{plan ? `${plan.maxEmployees} orang` : "—"}</strong></div><div className="registration-price-row total"><span>Total</span><strong>{plan ? rupiah(plan.monthlyPrice) : "—"}</strong></div><button type="button" className="btn btn-primary btn-block" disabled={!plan} onClick={() => setStep(3)}>Daftar Akun Sekarang <ArrowRight size={16}/></button><button type="button" className="registration-text-button" onClick={() => setStep(1)}>Ubah bidang perusahaan</button></div></section>}<p className="registration-terms">Dengan mendaftar, Anda menyetujui Syarat dan Ketentuan serta Kebijakan Privasi TepatWaktu.</p></div>}
      {step === 3 && <section className="registration-card account-card"><h1>Daftar Akun</h1><form className="registration-card-body" onSubmit={submit}>{error && <div className="error-box" role="alert">{error}</div>}<p>Isi data perusahaan dan administrator. Tautan aktivasi akan dikirim ke email Anda.</p><div className="registration-account-grid"><div className="field"><label htmlFor="companyName">Nama perusahaan</label><input className="input" id="companyName" name="companyName" placeholder="PT Contoh Indonesia" required minLength={2}/></div><div className="field"><label htmlFor="name">Nama lengkap administrator</label><input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" required minLength={2}/></div><div className="field"><label htmlFor="email">Email kerja</label><input className="input" id="email" name="email" type="email" placeholder="anda@perusahaan.com" autoComplete="email" required/></div><div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" placeholder="Minimal 8 karakter" minLength={8} autoComplete="new-password" required/></div></div><div className="registration-selected-plan">Paket terpilih: <strong>{plan?.name}</strong> · {plan ? rupiah(plan.monthlyPrice) : "—"} / bulan</div><div className="registration-actions"><button className="btn btn-outline" type="button" onClick={() => setStep(2)}><ArrowLeft size={16}/> Kembali</button><button className="btn btn-primary" disabled={loading}>{loading ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {loading ? "Mendaftarkan..." : "Buat akun"}</button></div></form></section>}
      {step === 4 && <section className="registration-card registration-finish"><div className="registration-card-body"><span className="registration-finish-icon"><MailCheck size={38}/></span><h1>{emailSent ? "Periksa email Anda" : "Akun dibuat, email belum terkirim"}</h1><p>{emailSent ? "Kami telah mengirim tautan verifikasi ke" : "Email verifikasi belum berhasil dikirim ke"} <strong>{registeredEmail}</strong>. {emailSent ? "Buka email dan klik tautannya untuk mengaktifkan akun perusahaan." : "Periksa pengaturan pengiriman sebelum mencoba lagi."}</p>{emailError && <div className="error-box" role="alert">{emailError}</div>}<Link className="btn btn-primary" href={`/verifikasi-email?email=${encodeURIComponent(registeredEmail)}`}>{emailSent ? "Lihat petunjuk verifikasi" : "Buka halaman verifikasi"} <ArrowRight size={16}/></Link></div></section>}
    </main><footer className="registration-footer">© {new Date().getFullYear()} TepatWaktu</footer>
  </div>;
}
