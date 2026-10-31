"use client";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

const CONFIRM_EVENT = "tepatwaktu:confirm-delete";
type ConfirmRequest = { message: string; title?: string; confirmLabel?: string; resolve: (confirmed: boolean) => void };

export function confirmAction(message: string, title = "Konfirmasi Tindakan", confirmLabel = "Ya, Lanjutkan") {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, { detail: { message, title, confirmLabel, resolve } }));
  });
}

export function confirmDelete(message: string, title = "Konfirmasi Hapus") {
  return confirmAction(message, title, "Ya, Hapus");
}

export function GlobalConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setRequest((event as CustomEvent<ConfirmRequest>).detail);
    window.addEventListener(CONFIRM_EVENT, receive);
    return () => window.removeEventListener(CONFIRM_EVENT, receive);
  }, []);
  function finish(confirmed: boolean) {
    request?.resolve(confirmed);
    setRequest(null);
  }
  return <ConfirmDialog open={Boolean(request)} title={request?.title} message={request?.message ?? ""} confirmLabel={request?.confirmLabel} onCancel={() => finish(false)} onConfirm={() => finish(true)}/>;
}

export function ConfirmDialog({ open, title = "Konfirmasi Hapus", message, confirmLabel = "Ya, Hapus", busy = false, onCancel, onConfirm }: { open: boolean; title?: string; message: string; confirmLabel?: string; busy?: boolean; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  if (!open) return null;
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <header><div className="confirm-icon"><AlertTriangle size={22}/></div><button type="button" aria-label="Tutup" disabled={busy} onClick={onCancel}><X size={18}/></button></header>
      <div><h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-message">{message}</p><small>Tindakan ini tidak dapat dibatalkan.</small></div>
      <footer><button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>Batal</button><button type="button" className="btn btn-danger" disabled={busy} onClick={() => void onConfirm()}>{busy ? "Menghapus..." : confirmLabel}</button></footer>
    </section>
  </div>;
}
