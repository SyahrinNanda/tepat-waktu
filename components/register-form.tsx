"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { signUp } from "@/lib/auth-client";

const industries = [
  ["Teknologi", "💻"], ["Pemerintahan", "🏛️"], ["F&B", "🍽️"],
  ["Jasa", "🔧"], ["Media", "🎬"], ["Lainnya", "✏️"],
];

const plans = [
  { id: "starter", name: "Starter", detail: "Untuk tim hingga 25 orang", price: "Gratis" },
  { id: "growth", name: "Growth", detail: "Untuk tim yang sedang berkembang", price: "Rp199rb/bln" },
];

export function RegisterForm() {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const steps = useMemo(() => [1, 2, 3, 4], []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const companyName = String(form.get("companyName"));

    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Akun belum dapat dibuat.");
        return;
      }

      const onboarding = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName, industry, plan }),
      });
      if (!onboarding.ok) {
        setError("Akun dibuat, tetapi profil perusahaan belum tersimpan. Silakan masuk lalu coba lagi.");
        return;
      }
      setDone(true);
      setStep(4);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa alamat dan port aplikasi, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="steps" aria-label={`Langkah ${step} dari 4`}>
        {steps.map((item) => <span className={`step ${item <= step ? "active" : ""}`} key={item} />)}
      </div>

      {step === 1 && (
        <section>
          <h1>Pilih bidang perusahaan</h1>
          <p className="lead">Informasi ini membantu kami menyiapkan pengalaman yang lebih relevan untuk bisnis Anda.</p>
          <div className="choice-grid">
            {industries.map(([name, icon]) => (
              <button className={`choice ${industry === name ? "selected" : ""}`} onClick={() => setIndustry(name)} key={name} type="button">
                <span className="choice-icon">{icon}</span><strong>{name}</strong>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" disabled={!industry} onClick={() => setStep(2)}>Lanjutkan <ArrowRight size={16} /></button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>Pilih paket</h1>
          <p className="lead">Mulai sederhana. Paket dapat diubah kapan saja ketika tim Anda bertumbuh.</p>
          <div className="choice-grid">
            {plans.map((item) => (
              <button className={`choice ${plan === item.id ? "selected" : ""}`} onClick={() => setPlan(item.id)} key={item.id} type="button">
                <strong>{item.name}</strong><small>{item.detail}</small><strong style={{ marginTop: 12, color: "var(--primary)" }}>{item.price}</strong>
              </button>
            ))}
          </div>
          <div className="action-row">
            <button className="btn btn-outline" onClick={() => setStep(1)}><ArrowLeft size={16} /> Kembali</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Lanjutkan <ArrowRight size={16} /></button>
          </div>
        </section>
      )}

      {step === 3 && (
        <form onSubmit={submit}>
          <h1>Daftar akun</h1>
          <p className="lead">Sedikit lagi. Buat akun administrator dan ruang kerja perusahaan Anda.</p>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="field"><label htmlFor="companyName">Nama perusahaan</label><input className="input" id="companyName" name="companyName" placeholder="PT Contoh Indonesia" required /></div>
          <div className="field"><label htmlFor="name">Nama lengkap</label><input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" required /></div>
          <div className="field"><label htmlFor="email">Email kerja</label><input className="input" id="email" name="email" type="email" placeholder="anda@perusahaan.com" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" placeholder="Minimal 8 karakter" minLength={8} autoComplete="new-password" required /></div>
          <div className="action-row">
            <button className="btn btn-outline" type="button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Kembali</button>
            <button className="btn btn-primary" disabled={loading}>{loading ? <LoaderCircle size={16} /> : <Check size={16} />}{loading ? "Menyiapkan…" : "Buat akun"}</button>
          </div>
        </form>
      )}

      {step === 4 && done && (
        <section style={{ textAlign: "center" }}>
          <div className="stat-icon green" style={{ margin: "0 auto 18px", width: 54, height: 54 }}><Check size={25} /></div>
          <h1>Ruang kerja siap!</h1>
          <p className="lead">Akun dan profil perusahaan Anda sudah dibuat. Mari mulai mengelola tim.</p>
          <Link href="/dashboard" className="btn btn-primary btn-block">Buka dashboard <ArrowRight size={16} /></Link>
        </section>
      )}
    </div>
  );
}
