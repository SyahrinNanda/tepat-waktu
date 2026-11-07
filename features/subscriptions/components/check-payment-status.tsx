"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const AUTO_INTERVAL_MS = 20_000;
const AUTO_LIMIT_MS = 15 * 60_000;

/**
 * Re-renders the payment result page, which re-reads the status from Midtrans on the server (and
 * redirects once the invoice becomes active). Also checks automatically while the page is open.
 */
export function CheckPaymentStatus() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const check = () => startTransition(() => {
    router.refresh();
    setCheckedAt(new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date()));
  });

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > AUTO_LIMIT_MS) return window.clearInterval(timer);
      if (document.visibilityState === "visible") router.refresh();
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return <>
    <button type="button" className="btn btn-outline" onClick={check} disabled={pending}>
      <RefreshCw size={15} className={pending ? "spin" : undefined} /> {pending ? "Memeriksa…" : "Cek status"}
    </button>
    {checkedAt && !pending && <p className="payment-result-checked" role="status">Belum ada pembayaran masuk (dicek pukul {checkedAt}). Halaman ini juga mengecek otomatis setiap 20 detik.</p>}
  </>;
}
