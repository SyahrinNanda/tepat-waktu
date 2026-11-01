"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clapperboard, Crown, Landmark, Laptop, LoaderCircle, MailCheck, Shapes, Ticket, UtensilsCrossed, Wrench } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { supabaseAuthEnabled, supabaseBrowser } from "@/lib/supabase/client";

export type RegistrationPlan = { code: string; name: string; monthlyPrice: number; maxEmployees: number; description: string; trialMonths: number; recommended: boolean };
const industries = [["Teknologi", Laptop], ["Pemerintahan", Landmark], ["F&B", UtensilsCrossed], ["Jasa", Wrench], ["Media", Clapperboard], ["Lainnya", Shapes]] as const;
const stepNames = ["Pilih Bidang", "Pilih Paket", "Daftar Akun", "Finish"];
const googleRegistrationKey = "tepatwaktu-google-registration";
const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export function RegistrationFlow({ plans }: { plans: RegistrationPlan[] }) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null);
  const plan = plans.find((item) => item.code === planCode);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("google") !== "1" || !supabaseAuthEnabled()) return;
    void (async () => {
      const result = await supabaseBrowser().auth.getUser();
      const identity = result.data.user;
      if (identity?.email) {
        setGoogleUser({ name: String(identity.user_metadata?.full_name || identity.user_metadata?.name || ""), email: identity.email });
        try {
          const saved = JSON.parse(sessionStorage.getItem(googleRegistrationKey) || "null") as { industry?: string; planCode?: string } | null;
          if (saved?.industry && saved.planCode && plans.some((item) => item.code === saved.planCode)) {
            setIndustry(saved.industry);
            setPlanCode(saved.planCode);
            setStep(3);
          }
        } catch { /* Browser storage can be unavailable; registration remains usable. */ }
      }
    })().catch(() => setError("Sesi Google tidak dapat dibaca. Silakan coba masuk kembali."));
  }, [plans]);

  async function googleRegister() {
    setError("");
    if (!supabaseAuthEnabled()) {
      setError("Login Google belum tersedia. Isi URL dan publishable key Supabase di .env.local, lalu bangun ulang aplikasi.");
      return;
    }
    setLoading(true);
    try {
      try { sessionStorage.setItem(googleRegistrationKey, JSON.stringify({ industry, planCode })); } catch { /* Continue without saved step. */ }
      const { error: oauthError } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (oauthError) setError(oauthError.message);
    } catch { setError("Google belum dikonfigurasi di Supabase Auth."); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const data = { industry, plan: planCode, companyName: String(form.get("companyName") || "").trim(), name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), password: String(form.get("password") || "") };
    try {
      if (googleUser) {
        const response = await fetch("/api/registration/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: data.companyName, name: data.name, industry: data.industry, plan: data.plan }) });
        const result = await response.json();
        if (!response.ok) { setError(result.message || "Ruang kerja belum berhasil dibuat."); return; }
      } else {
        const client = supabaseBrowser();
        const { data: signup, error: signupError } = await client.auth.signUp({ email: data.email, password: data.password, options: { data: { companyName: data.companyName, name: data.name, industry: data.industry, plan: data.plan }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (signupError) { setError(signupError.message); return; }
        if (signup.session) { await client.auth.signOut(); setError("Konfirmasi email belum aktif pada Supabase. Aktifkan Confirm email sebelum menerima pendaftaran."); return; }
        if (!signup.user || signup.user.identities?.length === 0) { setError("Email sudah terdaftar. Silakan masuk atau gunakan email lain."); return; }
      }
      setRegisteredEmail(googleUser?.email || data.email);
      if (googleUser) { try { sessionStorage.removeItem(googleRegistrationKey); } catch { /* No stored step. */ } }
      setStep(4);
    } catch { setError("Tidak dapat menghubungi server. Silakan coba lagi."); }
    finally { setLoading(false); }
  }

  return <div className="registration-page">
    <header className="registration-header"><div className="registration-header-inner"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><nav className="registration-steps" aria-label="Tahap pendaftaran">{stepNames.map((name, index) => <div className={`registration-step ${step >= index + 1 ? "is-active" : ""}`} key={name}><span>{index + 1}</span><small>{name}</small></div>)}</nav></div></header>
    <main className={`registration-main ${showPlans && step === 2 ? "plans-open" : ""}`}>
      {step === 1 && <section className="registration-card industry-card"><h1>Pilih Bidang Perusahaan</h1><div className="registration-card-body"><div className="industry-grid">{industries.map(([name, Icon]) => <button key={name} type="button" className={`industry-option ${industry === name ? "is-selected" : ""}`} onClick={() => setIndustry(name)} aria-pressed={industry === name}><span><Icon size={28} strokeWidth={1.8}/></span><strong>{name}</strong></button>)}</div><p>Informasi bidang perusahaan membantu kami memberikan fitur yang lebih relevan untuk bisnis Anda.</p><div className="registration-actions"><Link href="/" className="btn btn-outline"><ArrowLeft size={16}/> Kembali ke login</Link><button className="btn btn-primary" type="button" disabled={!industry} onClick={() => setStep(2)}>Lanjutkan <ArrowRight size={16}/></button></div></div></section>}
      {step === 2 && <div className="registration-plan-area">{showPlans ? <><button className="btn btn-outline" type="button" onClick={() => setShowPlans(false)}><ArrowLeft size={16}/> Kembali</button><h1>Pilih Paket TepatWaktu</h1><div className="registration-plans-grid">{plans.map((item) => <article className={`registration-plan-card ${planCode === item.code ? "selected" : ""} ${item.recommended ? "is-recommended" : ""}`} key={item.code}><div className="registration-plan-name"><span className="registration-plan-icon">{item.recommended ? <Crown size={15}/> : <Ticket size={15}/>}</span> Paket {item.name} {item.recommended && <em>REKOMENDASI</em>}</div><div className="registration-plan-content"><div className="registration-plan-price">{rupiah(item.monthlyPrice)} <small>/ bulan</small></div><button type="button" className={`btn ${planCode === item.code ? "btn-primary" : "btn-outline"} btn-block`} onClick={() => { setPlanCode(item.code); setShowPlans(false); }}>{planCode === item.code ? "Paket dipilih" : "Pilih Paket"}</button><p>APA YANG ANDA PEROLEH</p><ul><li><Check size={15}/> Maksimal {item.maxEmployees} karyawan</li>{item.trialMonths > 0 && <li><Check size={15}/> Gratis selama {item.trialMonths} bulan</li>}<li><Check size={15}/> {item.description}</li></ul></div></article>)}</div></> : <section className="registration-card plan-summary"><h1>Pilih Paket</h1><div className="registration-card-body"><p>{plan ? `Paket ${plan.name}` : "Belum ada paket dipilih"}</p><button type="button" className="registration-all-plans" onClick={() => setShowPlans(true)}>Lihat Semua Paket <ArrowRight size={16}/></button><div className="registration-price-row"><span>Harga per bulan</span><strong>{plan ? rupiah(plan.monthlyPrice) : "—"}</strong></div><div className="registration-price-row"><span>Jumlah karyawan</span><strong>{plan ? `${plan.maxEmployees} orang` : "—"}</strong></div><div className="registration-price-row total"><span>Total</span><strong>{plan ? rupiah(plan.monthlyPrice) : "—"}</strong></div><button type="button" className="btn btn-primary btn-block" disabled={!plan} onClick={() => setStep(3)}>Daftar Akun Sekarang <ArrowRight size={16}/></button><button type="button" className="registration-text-button" onClick={() => setStep(1)}>Ubah bidang perusahaan</button></div></section>}<p className="registration-terms">Dengan mendaftar, Anda menyetujui Syarat dan Ketentuan serta Kebijakan Privasi TepatWaktu.</p></div>}
      {step === 3 && <section className="registration-card account-card"><h1>Daftar Akun</h1><form className="registration-card-body" onSubmit={submit}>{error && <div className="error-box" role="alert">{error}</div>}<p>{googleUser ? "Lengkapi data perusahaan untuk akun Google Anda." : "Isi data perusahaan dan administrator. Tautan aktivasi akan dikirim ke email Anda."}</p>{!googleUser && <><button className="btn btn-outline btn-block registration-google-button" type="button" disabled={loading} onClick={googleRegister}>G&nbsp; Daftar dengan Google</button><div className="registration-divider"><span>atau daftar dengan email</span></div></>}<div className="registration-account-grid"><div className="field"><label htmlFor="companyName">Nama perusahaan</label><input className="input" id="companyName" name="companyName" placeholder="PT Contoh Indonesia" required minLength={2}/></div><div className="field"><label htmlFor="name">Nama lengkap administrator</label><input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" defaultValue={googleUser?.name} required minLength={2}/></div><div className="field"><label htmlFor="email">Email kerja</label><input className="input" id="email" name="email" type="email" placeholder="anda@perusahaan.com" autoComplete="email" defaultValue={googleUser?.email} readOnly={Boolean(googleUser)} required/></div>{!googleUser && <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" placeholder="Minimal 8 karakter" minLength={8} autoComplete="new-password" required/></div>}</div><div className="registration-selected-plan"><span className="registration-plan-icon"><Ticket size={16}/></span><span>Paket terpilih<strong>{plan?.name} · {plan ? rupiah(plan.monthlyPrice) : "—"} / bulan</strong></span><button type="button" className="registration-text-button" onClick={() => setStep(2)}>Ubah</button></div><div className="registration-actions"><button className="btn btn-outline" type="button" onClick={() => setStep(2)}><ArrowLeft size={16}/> Kembali</button><button className="btn btn-primary" disabled={loading}>{loading ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {loading ? "Mendaftarkan..." : "Buat akun"}</button></div></form></section>}
      {step === 4 && <section className="registration-card registration-finish"><div className="registration-card-body"><span className="registration-finish-icon"><MailCheck size={38}/></span><h1>{googleUser ? "Ruang kerja siap" : "Periksa email Anda"}</h1><p>{googleUser ? "Akun Google dan ruang kerja perusahaan sudah terhubung." : <>Tautan verifikasi telah dikirim ke <strong>{registeredEmail}</strong>. Buka email dan klik tautannya untuk mengaktifkan akun perusahaan.</>}</p>{googleUser ? <Link className="btn btn-primary" href="/masuk/lanjut">Buka dashboard <ArrowRight size={16}/></Link> : <Link className="btn btn-primary" href={`/verifikasi-email?email=${encodeURIComponent(registeredEmail)}`}>Lihat petunjuk verifikasi <ArrowRight size={16}/></Link>}</div></section>}
    </main><footer className="registration-footer">© {new Date().getFullYear()} TepatWaktu</footer>
  </div>;
}
