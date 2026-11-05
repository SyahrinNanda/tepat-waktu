"use client";

import { Lock, LogOut } from "lucide-react";
import { resolveTimeZone } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

const day = (value: string, timeZone?: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: resolveTimeZone(timeZone) }).format(new Date(value));

/** Shown to non-admin members while their company's subscription is expired. */
export function SubscriptionLocked({ companyName, userName, planName, endsAt, timezone }: { companyName: string; userName: string; planName: string | null; endsAt: string | null; timezone?: string }) {
  const router = useRouter();
  async function logout() {
    await signOut();
    router.push("/");
    router.refresh();
  }
  return <main className="subscription-locked">
    <section className="subscription-locked-card" role="alert">
      <span className="subscription-locked-icon"><Lock size={26} /></span>
      <span className="eyebrow">{companyName}</span>
      <h1>Masa aktif paket telah berakhir</h1>
      <p>Halo {userName.split(" ")[0]}, akses TepatWaktu untuk perusahaan Anda sementara dihentikan{planName ? <> karena <strong>Paket {planName}</strong></> : null}{endsAt ? <> berakhir pada <strong>{day(endsAt, timezone)}</strong></> : null}.</p>
      <p>Hubungi <strong>Admin Perusahaan</strong> untuk memperpanjang langganan atau memilih paket lain. Data Anda tetap aman dan bisa dipakai lagi setelah paket aktif.</p>
      <button className="btn btn-outline" type="button" onClick={logout}><LogOut size={16} /> Keluar</button>
    </section>
  </main>;
}
