"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";

export function RequestForm({ type }: { type: "password" | "deletion" }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const endpoint = type === "deletion" ? "/api/deletion-requests" : "/api/password-reset";
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email")), reason: String(form.get("reason") ?? "") }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setError(payload.message ?? "Permintaan belum dapat dikirim.");
      else setMessage(payload.message ?? "Permintaan berhasil diterima.");
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="error-box" role="alert">{error}</div>}
      {message && <div className="success-box" role="status">{message}</div>}
      <div className="field">
        <label htmlFor="email">{type === "deletion" ? "Email akun" : "Email"}</label>
        <div className={type === "deletion" ? "login-field-wrap" : undefined}>
          {type === "deletion" && <Mail size={17} aria-hidden="true" />}
          <input className="input" id="email" name="email" type="email" placeholder="nama@perusahaan.com" autoComplete="email" required />
        </div>
      </div>
      {type === "deletion" && <div className="field"><label htmlFor="reason">Alasan penghapusan (opsional)</label><textarea className="input" id="reason" name="reason" placeholder="Ceritakan alasan Anda menghapus akun" maxLength={500} rows={4} /></div>}
      <button className="btn btn-primary btn-block" disabled={loading}>
        {loading && <LoaderCircle size={16} className="spin" />}{loading ? "Mengirim…" : type === "deletion" ? "Ajukan penghapusan akun" : "Kirim tautan verifikasi"}
      </button>
    </form>
  );
}
