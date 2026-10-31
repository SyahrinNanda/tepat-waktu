"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";

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
        <label htmlFor="email">{type === "deletion" ? "Email karyawan" : "Email"}</label>
        <input className="input" id="email" name="email" type="email" placeholder="emailanda@perusahaan.com" required />
      </div>
      {type === "deletion" && <div className="field"><label htmlFor="reason">Alasan (opsional)</label><textarea className="input" id="reason" name="reason" placeholder="Ceritakan alasan penghapusan data" /></div>}
      <button className={`btn btn-block ${type === "deletion" ? "btn-danger" : "btn-primary"}`} disabled={loading}>
        {loading && <LoaderCircle size={16} />}{loading ? "Mengirim…" : type === "deletion" ? "Ajukan penghapusan" : "Kirim tautan verifikasi"}
      </button>
    </form>
  );
}
