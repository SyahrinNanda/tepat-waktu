"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/** Requests a new verification link. The answer never reveals whether the email has an account. */
export function ResendVerification({ email: initialEmail = "" }: { email?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const result = await authClient.sendVerificationEmail({ email: email.trim().toLowerCase(), callbackURL: "/verifikasi-email/berhasil" }).catch(() => null);
    // 429 = escalating resend limit (1 min, 5 min, 1 h, 5 h, 24 h); the server says how long to wait.
    const limited = result?.error?.status === 429;
    setErrorText(limited ? result?.error?.message || "Terlalu sering meminta email. Coba lagi nanti." : "Server tidak dapat dihubungi. Coba lagi beberapa saat lagi.");
    setState(!result || limited ? "error" : "sent");
  }

  return <form className="resend-verification" onSubmit={submit}>
    {state === "sent" ? <div className="success-box" role="status">Jika akun belum terverifikasi, tautan baru sudah dikirim ke {email}. Periksa juga folder spam.</div> : null}
    {state === "error" ? <div className="error-box" role="alert">{errorText}</div> : null}
    {initialEmail ? null : <input className="input" type="email" required placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email akun" />}
    <button className="btn btn-primary" type="submit" disabled={state === "sending" || !email}>{state === "sending" ? <LoaderCircle size={16} className="spin" /> : null} Kirim ulang tautan verifikasi</button>
  </form>;
}
