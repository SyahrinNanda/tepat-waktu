"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, CalendarX2, X } from "lucide-react";
import type { SubscriptionStatus } from "../server/subscription-status";
import { resolveTimeZone } from "@/lib/timezone";

export type SubscriptionAlertInput = Pick<SubscriptionStatus, "state" | "endsAt" | "daysLeft" | "warning" | "planName" | "orderId"> & {
  /** Company time zone for the dates shown. */
  timezone?: string;
};

const day = (value: string, timeZone?: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: resolveTimeZone(timeZone) }).format(new Date(value));

export function subscriptionAlertCopy(status: SubscriptionAlertInput, canRenew: boolean) {
  const plan = status.planName ? `Paket ${status.planName}` : "Paket perusahaan";
  const action = canRenew ? "Perpanjang sekarang atau pilih paket lain agar seluruh akun tetap bisa mengakses TepatWaktu." : "Hubungi Admin Perusahaan untuk memperpanjang agar akun Anda tetap bisa mengakses TepatWaktu.";
  if (status.state === "expired") return { tone: "expired", title: `${plan} telah berakhir`, body: canRenew ? "Akses seluruh akun dihentikan. Perpanjang atau pilih paket baru untuk membukanya kembali." : "Akses dihentikan sampai paket diperpanjang." };
  const left = status.daysLeft ?? 0;
  const when = left <= 1 ? "kurang dari 1 hari lagi" : `${left} hari lagi`;
  return { tone: status.warning === 2 ? "urgent" : "warning", title: `${plan} berakhir ${when}`, body: `${status.endsAt ? `Masa aktif sampai ${day(status.endsAt, status.timezone)}. ` : ""}${action}` };
}

export function hasSubscriptionAlert(status: SubscriptionAlertInput) {
  return status.state === "expired" || status.warning !== null;
}

/** Persistent strip at the top of every dashboard page while a warning applies. */
export function SubscriptionBanner({ status, canRenew }: { status: SubscriptionAlertInput; canRenew: boolean }) {
  if (!hasSubscriptionAlert(status)) return null;
  const text = subscriptionAlertCopy(status, canRenew);
  return <div className={`subscription-banner ${text.tone}`} role={status.warning === 2 || status.state === "expired" ? "alert" : "status"}>
    {status.state === "expired" ? <CalendarX2 size={18} /> : <AlarmClock size={18} />}
    <span><strong>{text.title}.</strong> {text.body}</span>
    {canRenew ? <Link className="btn btn-sm" href="/dashboard/langganan">Perpanjang</Link> : null}
  </div>;
}

/**
 * Popup shown once per user for each threshold (5 days, then 2 days before expiry).
 * Dismissal is remembered in this browser; the banner and bell stay until renewal.
 */
export function SubscriptionWarningDialog({ status, canRenew, userKey }: { status: SubscriptionAlertInput; canRenew: boolean; userKey: string }) {
  const [open, setOpen] = useState(false);
  const storageKey = `tepatwaktu:sub-warning:${userKey}:${status.orderId}:${status.warning}`;
  useEffect(() => {
    if (status.state !== "active" || !status.warning) return;
    let seen = false;
    try { seen = window.localStorage.getItem(storageKey) === "1"; } catch { /* storage unavailable: show it */ }
    // Opening after mount keeps server and client markup identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen(true);
  }, [status.state, status.warning, storageKey]);
  if (!open) return null;
  function close() {
    try { window.localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setOpen(false);
  }
  const text = subscriptionAlertCopy(status, canRenew);
  return <div className="standard-modal-overlay" onClick={close}>
    <div className={`standard-modal-card subscription-warning-dialog ${text.tone}`} role="alertdialog" aria-modal="true" aria-labelledby="subscription-warning-title" onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><span className="subscription-warning-icon"><AlarmClock size={22} /></span><h2 id="subscription-warning-title">{text.title}</h2></div><button className="icon-button" type="button" onClick={close} aria-label="Tutup"><X size={18} /></button></header>
      <div className="standard-modal-body"><p>{text.body}</p></div>
      <footer className="standard-modal-footer">
        <button className="btn btn-outline" type="button" onClick={close}>Nanti</button>
        {canRenew ? <Link className="btn btn-primary" href="/dashboard/langganan" onClick={close}>Perpanjang Sekarang</Link> : <button className="btn btn-primary" type="button" onClick={close}>Mengerti</button>}
      </footer>
    </div>
  </div>;
}

/** Topbar bell; the dot and the entry appear only while there is a subscription warning. */
export function SubscriptionBell({ status, canRenew }: { status: SubscriptionAlertInput; canRenew: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const alert = hasSubscriptionAlert(status);
  const text = alert ? subscriptionAlertCopy(status, canRenew) : null;
  return <div className="notification-wrap" ref={ref}>
    <button className="icon-button notification-button" type="button" aria-label={alert ? "Notifikasi (1 baru)" : "Notifikasi"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={19} />
      {alert ? <i /> : null}
    </button>
    {open ? <div className="notification-panel" role="dialog" aria-label="Notifikasi">
      <strong className="notification-panel-title">Notifikasi</strong>
      {text ? <div className={`notification-item ${text.tone}`}><AlarmClock size={16} /><span><b>{text.title}</b><small>{text.body}</small>{canRenew ? <Link href="/dashboard/langganan" onClick={() => setOpen(false)}>Buka Langganan</Link> : null}</span></div>
        : <p className="notification-empty">Belum ada notifikasi.</p>}
    </div> : null}
  </div>;
}
