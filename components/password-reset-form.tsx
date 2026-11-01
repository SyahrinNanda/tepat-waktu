"use client";

import Link from "next/link";
import { useState } from "react";

export function PasswordResetForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8 || password !== confirmation) { setError("Password minimal 8 karakter dan konfirmasinya harus sama."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/password-reset/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) setError(result.message || "Password belum dapat diperbarui.");
      else setMessage("Password berhasil diperbarui. Silakan masuk kembali.");
    } catch { setError("Tidak dapat menghubungi server."); }
    finally { setLoading(false); }
  }

  return <>
    {error && <div className="error-box" role="alert">{error}</div>}
    {message && <div className="success-box" role="status">{message}</div>}
    <form onSubmit={submit}><div className="field"><label htmlFor="newPassword">Password baru</label><input id="newPassword" className="input" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></div>
      <div className="field"><label htmlFor="confirmPassword">Konfirmasi password</label><input id="confirmPassword" className="input" type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required/></div>
      <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Menyimpan..." : "Simpan password"}</button>
    </form><p className="auth-foot"><Link className="text-link" href="/">Kembali ke login</Link></p>
  </>;
}
