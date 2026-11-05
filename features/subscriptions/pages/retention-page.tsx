import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlarmClock, Gauge, Hourglass, Lock, Mail, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { companies, subscriptionPlans, subscriptionReminders } from "@/db/schema";
import { mailConfigured, mailProviderStatus } from "@/lib/mailer";
import { enterCompanyAction } from "../server/enter-company";
import { isTrial, loadCompanySubscriptions, type CompanySubscription } from "../server/company-subscriptions";
import { ExtendButton, ExtendDialogProvider, RunRemindersButton } from "../components/retention-actions";

const WINDOW_DAYS = 7;
const tabs = [
  { key: "expiring", label: "Habis ≤ 7 hari", icon: AlarmClock },
  { key: "trial", label: "Trial hampir selesai", icon: Hourglass },
  { key: "expired", label: "Sudah terkunci", icon: Lock },
  { key: "capacity", label: "Kapasitas ≥ 90%", icon: Gauge },
] as const;
const CAPACITY_THRESHOLD = 0.9;
type TabKey = (typeof tabs)[number]["key"];

const dayFmt = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(value);
const dateTimeFmt = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);
const timeFmt = (value: Date) => new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);
const daysSince = (value: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000));

function usage(company: CompanySubscription) {
  return company.order && company.order.maxEmployees > 0 ? company.activeEmployees / company.order.maxEmployees : 0;
}

function bucket(company: CompanySubscription): Exclude<TabKey, "capacity"> | null {
  if (company.status.state === "expired") return "expired";
  if (company.status.state !== "active" || company.status.daysLeft === null || company.status.daysLeft > WINDOW_DAYS) return null;
  return isTrial(company) ? "trial" : "expiring";
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

export async function RetentionPage({ tab }: { tab?: string }) {
  const now = new Date();
  const active: TabKey = tabs.some((item) => item.key === tab) ? tab as TabKey : "expiring";
  const [all, plans, log, mailStatus] = await Promise.all([
    loadCompanySubscriptions(now),
    db.select({ id: subscriptionPlans.id, name: subscriptionPlans.name, monthlyPrice: subscriptionPlans.monthlyPrice, maxEmployees: subscriptionPlans.maxEmployees, companyId: subscriptionPlans.companyId })
      .from(subscriptionPlans).where(eq(subscriptionPlans.active, true)).orderBy(subscriptionPlans.monthlyPrice),
    db.select({ id: subscriptionReminders.id, company: companies.name, level: subscriptionReminders.level, status: subscriptionReminders.status, recipients: subscriptionReminders.recipients, error: subscriptionReminders.error, attempts: subscriptionReminders.attempts, provider: subscriptionReminders.provider, updatedAt: subscriptionReminders.updatedAt })
      .from(subscriptionReminders).innerJoin(companies, eq(subscriptionReminders.companyId, companies.id)).orderBy(desc(subscriptionReminders.updatedAt)).limit(15),
    mailProviderStatus(now),
  ]);
  const providerLabel = new Map(mailStatus.map((provider) => [provider.name, provider.label]));
  const grouped: Record<TabKey, CompanySubscription[]> = { expiring: [], trial: [], expired: [], capacity: [] };
  for (const company of all) { const key = bucket(company); if (key) grouped[key].push(company); }
  // Upgrade candidates: running subscriptions using 90%+ of their employee limit.
  grouped.capacity = all.filter((company) => company.status.state === "active" && usage(company) >= CAPACITY_THRESHOLD).sort((a, b) => usage(b) - usage(a));
  const publicPlans = plans.filter((plan) => plan.companyId === null && plan.monthlyPrice > 0).sort((a, b) => a.maxEmployees - b.maxEmployees);
  const nextPlan = (company: CompanySubscription) => publicPlans.find((plan) => plan.maxEmployees > (company.order?.maxEmployees ?? 0)) ?? null;
  const upgradeRevenue = grouped.capacity.reduce((sum, company) => sum + Math.max(0, (nextPlan(company)?.monthlyPrice ?? 0) - (company.order?.monthlyPrice ?? 0)), 0);
  grouped.expiring.sort((a, b) => (a.status.daysLeft ?? 0) - (b.status.daysLeft ?? 0));
  grouped.trial.sort((a, b) => (a.status.daysLeft ?? 0) - (b.status.daysLeft ?? 0));
  grouped.expired.sort((a, b) => (b.lastEndedAt?.getTime() ?? 0) - (a.lastEndedAt?.getTime() ?? 0));
  const rows = grouped[active];
  const mailReady = mailConfigured();
  const atRiskRevenue = grouped.expiring.reduce((sum, company) => sum + (company.order?.monthlyPrice ?? 0), 0);

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Retensi</span><h1>RETENSI PELANGGAN</h1><p>Daftar kerja harian tim sales & CS: hubungi perusahaan sebelum paketnya habis, dan ajak kembali yang sudah terkunci.</p></div></header>

    <section className="complaint-tiles retention-tiles">
      <article className="complaint-tile total"><span>Habis dalam {WINDOW_DAYS} hari</span><strong>{grouped.expiring.length}</strong><small>Pendapatan berisiko {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(atRiskRevenue)}/bln</small></article>
      <article className="complaint-tile"><span>Trial hampir selesai</span><strong>{grouped.trial.length}</strong><small>Peluang konversi ke berbayar</small></article>
      <article className="complaint-tile"><span>Sudah terkunci</span><strong>{grouped.expired.length}</strong><small>Perlu diajak kembali</small></article>
      <article className="complaint-tile"><span>Kandidat upgrade</span><strong>{grouped.capacity.length}</strong><small>Potensi +{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(upgradeRevenue)}/bln</small></article>
      <article className="complaint-tile"><span>Email pengingat</span><strong className="industry-tile-text">{mailReady ? "Aktif" : "Belum aktif"}</strong><small>{mailReady ? `Otomatis H-5 & H-2 · ${mailStatus.length} layanan email` : "Isi MAIL_PROVIDERS agar email terkirim"}</small></article>
    </section>

    <nav className="retention-tabs" aria-label="Kategori">{tabs.map((item) => {
      const Icon = item.icon;
      return <Link key={item.key} href={`/superadmin/retensi?tab=${item.key}`} className={item.key === active ? "active" : ""} aria-current={item.key === active ? "page" : undefined}><Icon size={15} /> {item.label} <b>{grouped[item.key].length}</b></Link>;
    })}</nav>

    <ExtendDialogProvider plans={plans}>
    <section className="module-card retention-table">
      {active === "capacity" ? (rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Perusahaan</th><th>Paket</th><th>Pemakaian karyawan</th><th>Saran upgrade</th><th>Kontak admin</th><th aria-label="Aksi" /></tr></thead>
        <tbody>{rows.map((company) => {
          const admin = company.admins[0];
          const ratio = usage(company);
          const suggestion = nextPlan(company);
          const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
          return <tr key={company.id}>
            <td><Link className="retention-company-link" href={`/superadmin/perusahaan/${company.id}`}><strong>{company.name}</strong></Link><small className="retention-sub">{company.industry}</small></td>
            <td>{company.order?.planName}<small className="retention-sub">Maks. {company.order?.maxEmployees.toLocaleString("id-ID")} karyawan</small></td>
            <td><div className="capacity-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Pemakaian kapasitas"><span style={{ width: `${Math.min(100, ratio * 100)}%` }} className={ratio >= 1 ? "full" : ""} /></div><small className={`retention-days ${ratio >= 1 ? "expired" : ""}`}>{company.activeEmployees.toLocaleString("id-ID")} / {company.order?.maxEmployees.toLocaleString("id-ID")} ({Math.round(ratio * 100)}%){ratio >= 1 ? " · penuh" : ""}</small></td>
            <td>{suggestion ? <><strong>{suggestion.name}</strong><small className="retention-sub">{suggestion.maxEmployees.toLocaleString("id-ID")} karyawan · +{rupiah(Math.max(0, suggestion.monthlyPrice - (company.order?.monthlyPrice ?? 0)))}/bln</small></> : <><strong>Paket Custom</strong><small className="retention-sub">Sudah di paket terbesar</small></>}</td>
            <td>{admin ? <><strong>{admin.name}</strong><span className="retention-contact"><a href={`mailto:${admin.email}`}><Mail size={13} /> {admin.email}</a>{company.phone ? <a href={waLink(company.phone)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a> : null}</span></> : <span className="retention-sub">Belum ada admin</span>}</td>
            <td className="retention-actions"><ExtendButton company={{ id: company.id, name: company.name }} defaultPlanId={suggestion?.id ?? company.order?.planId ?? null} /></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state"><Gauge size={26} /><strong>Belum ada kandidat upgrade</strong><span>Perusahaan yang memakai 90% atau lebih dari batas karyawan paketnya akan muncul di sini.</span></div>) : rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Perusahaan</th><th>Paket</th><th>{active === "expired" ? "Terkunci sejak" : "Berakhir"}</th><th>Kontak admin</th><th>Pengingat</th><th aria-label="Aksi" /></tr></thead>
        <tbody>{rows.map((company) => {
          const admin = company.admins[0];
          const ends = company.order?.endsAt ?? company.lastEndedAt;
          const days = company.status.daysLeft ?? 0;
          return <tr key={company.id}>
            <td><Link className="retention-company-link" href={`/superadmin/perusahaan/${company.id}`}><strong>{company.name}</strong></Link><small className="retention-sub">{company.industry} · {company.activeEmployees} karyawan aktif</small></td>
            <td>{company.order?.planName ?? company.lastPlanName ?? "—"}{company.order && company.order.monthlyPrice > 0 ? <small className="retention-sub">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(company.order.monthlyPrice)}/bln</small> : null}</td>
            <td>{ends ? dayFmt(ends) : "—"}<small className={`retention-days ${active === "expired" ? "expired" : days <= 2 ? "urgent" : ""}`}>{active === "expired" ? (ends ? `${daysSince(ends, now)} hari lalu` : "dibatalkan") : days <= 1 ? "< 1 hari lagi" : `${days} hari lagi`}</small></td>
            <td>{admin ? <><strong>{admin.name}</strong><span className="retention-contact"><a href={`mailto:${admin.email}`}><Mail size={13} /> {admin.email}</a>{company.phone ? <><a href={waLink(company.phone)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a><a href={`tel:${company.phone}`}><Phone size={13} /> {company.phone}</a></> : null}</span></> : <span className="retention-sub">Belum ada admin</span>}</td>
            <td>{active === "expired" ? <span className="retention-sub">—</span> : <span className="retention-reminders">{[5, 2].map((level) => <span key={level} className={company.remindersSent.includes(level) ? "sent" : ""} title={company.remindersSent.includes(level) ? `Email H-${level} terkirim` : `Email H-${level} belum terkirim`}>H-{level}</span>)}</span>}</td>
            <td className="retention-actions"><ExtendButton company={{ id: company.id, name: company.name }} defaultPlanId={company.order?.planId ?? company.lastPlanId} /><form action={enterCompanyAction}><input type="hidden" name="companyId" value={company.id} /><button className="btn btn-outline btn-sm" type="submit">Masuk</button></form></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state"><AlarmClock size={26} /><strong>Tidak ada perusahaan di kategori ini</strong><span>Daftar akan terisi otomatis saat ada paket yang mendekati masa berakhir.</span></div>}
    </section>
    </ExtendDialogProvider>

    <section className="module-card retention-log">
      <div className="card-head"><div><h2 className="card-title">Riwayat email pengingat</h2><p className="card-subtitle">Dikirim hanya ke akun Admin Perusahaan. Email yang gagal dicoba ulang hingga 3 kali.</p></div><RunRemindersButton mailReady={mailReady} /></div>
      {mailStatus.length ? <div className="mail-providers" aria-label="Layanan email hari ini">
        <span className="mail-providers-title">Layanan email hari ini <small>(dicoba berurutan · kuota harian reset pukul 08.00 WITA)</small></span>
        <ol>{mailStatus.map((provider) => <li key={provider.name} className={`mail-provider is-${provider.state}`} title={provider.lastError ?? undefined}>
          <strong>{provider.label}</strong>
          <span>{provider.sent}{provider.dailyLimit ? ` / ${provider.dailyLimit}` : ""} terkirim{provider.failed ? ` · ${provider.failed} gagal` : ""}</span>
          <em>{provider.state === "full" ? "Kuota habis" : provider.state === "paused" ? `Dijeda s/d ${timeFmt(provider.blockedUntil!)}` : "Siap"}</em>
        </li>)}</ol>
      </div> : null}
      {log.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Waktu</th><th>Perusahaan</th><th>Tahap</th><th>Penerima</th><th>Layanan</th><th>Status</th></tr></thead>
        <tbody>{log.map((row) => <tr key={row.id}>
          <td>{dateTimeFmt(row.updatedAt)}</td><td>{row.company}</td><td>H-{row.level}</td><td className="retention-recipients">{row.recipients}</td><td>{row.provider ? providerLabel.get(row.provider) ?? row.provider : "—"}</td>
          <td><span className={`badge ${row.status === "sent" ? "green" : row.status === "failed" ? "red" : "orange"}`}>{row.status === "sent" ? "Terkirim" : row.status === "failed" ? `Gagal (${row.attempts}x)` : "Mengirim"}</span>{row.error ? <small className="retention-sub">{row.error}</small> : null}</td>
        </tr>)}</tbody>
      </table></div> : <p className="retention-sub" style={{ padding: "8px 0" }}>Belum ada email pengingat yang dikirim.</p>}
    </section>
  </>;
}
