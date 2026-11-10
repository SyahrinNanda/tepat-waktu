"use client";

import type { Route } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, Building2, CheckCircle2, CreditCard, Eye, Plus, Search, Settings, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";

type Kind = "dashboard" | "companies" | "subscriptions" | "plans" | "settings" | "company-detail";

const companies = [
  ["Nusantara Kreatif", "Teknologi", "Growth", "38", "Aktif", "16 Okt 2026"],
  ["Sentosa Retail Group", "Retail", "Business", "126", "Aktif", "15 Okt 2026"],
  ["Mitra Karya Abadi", "Jasa", "Starter", "18", "Trial", "14 Okt 2026"],
  ["Cahaya Pangan", "F&B", "Growth", "54", "Tertunda", "12 Okt 2026"],
];

export function SuperAdminPage({ kind }: { kind: Kind }) {
  if (kind === "dashboard") return <PlatformDashboard />;
  if (kind === "company-detail") return <CompanyDetail />;
  if (kind === "plans") return <PlatformPlans />;
  if (kind === "settings") return <PlatformSettings />;
  return <PlatformTable kind={kind} />;
}

function PlatformDashboard() {
  return <><PageHead eyebrow="PLATFORM TEPATWAKTU" title="Ringkasan seluruh perusahaan" copy="Pantau tenant, pengguna, langganan, dan kesehatan platform dari satu tempat." />
    <section className="stats-grid superadmin-stats"><PlatformStat icon={<Building2 />} label="Total Perusahaan" value="248" meta="+12 bulan ini" tone="blue" /><PlatformStat icon={<Users />} label="Pengguna Aktif" value="8.429" meta="di 248 perusahaan" tone="green" /><PlatformStat icon={<CreditCard />} label="Langganan Berbayar" value="184" meta="74,2% tenant" tone="purple" /><PlatformStat icon={<TrendingUp />} label="MRR" value="Rp 68,4 jt" meta="+8,7% bulan ini" tone="orange" /></section>
    <section className="superadmin-dashboard-grid"><div className="module-card platform-health"><div className="card-heading-row"><div><span className="eyebrow">KESEHATAN PLATFORM</span><h2>Status layanan</h2></div><span className="status-pill green">Semua Sistem Normal</span></div><div className="health-list"><Health label="Autentikasi & sesi" value="99,99%" /><Health label="API kehadiran" value="99,97%" /><Health label="Database PostgreSQL" value="99,99%" /><Health label="Penyimpanan foto" value="99,95%" /></div></div><div className="module-card platform-alerts"><div className="card-heading-row"><div><span className="eyebrow">PERLU PERHATIAN</span><h2>Notifikasi platform</h2></div></div><div><AlertTriangle size={18} /><span><strong>3 pembayaran tertunda</strong><small>Perlu pemeriksaan rekonsiliasi</small></span></div><div><Activity size={18} /><span><strong>12 perusahaan trial</strong><small>Berakhir dalam 7 hari</small></span></div><div><ShieldCheck size={18} /><span><strong>Tidak ada insiden keamanan</strong><small>24 jam terakhir</small></span></div></div></section>
  </>;
}

function PlatformTable({ kind }: { kind: "companies" | "subscriptions" }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => companies.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase())), [query]);
  const subscriptions = companies.map((row, index) => [row[0], row[2], ["Rp 199.000", "Rp 499.000", "Rp 0", "Rp 199.000"][index], ["Lunas", "Lunas", "Trial", "Tertunda"][index], ["28 Okt 2026", "01 Nov 2026", "23 Okt 2026", "18 Okt 2026"][index]]);
  const rows = kind === "companies" ? visible : subscriptions.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><PageHead eyebrow="SUPER ADMIN" title={kind === "companies" ? "Semua Perusahaan" : "Langganan Seluruh Perusahaan"} copy={kind === "companies" ? "Kelola perusahaan yang mendaftar dan buka detail tenant secara aman." : "Pantau paket, tagihan, pembayaran, dan status langganan lintas tenant."} />
    <section className="module-card"><div className="module-toolbar"><label className="search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari perusahaan..." /></label><div className="toolbar-spacer" /><button className="btn btn-primary btn-compact"><Plus size={16} /> {kind === "companies" ? "Tambah Perusahaan" : "Buat Langganan"}</button></div><div className="table-scroll"><table className="data-table"><thead><tr>{(kind === "companies" ? ["Perusahaan", "Industri", "Paket", "Karyawan", "Status", "Terdaftar", "Aksi"] : ["Perusahaan", "Paket", "Nilai", "Status", "Perpanjangan", "Aksi"]).map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}<td><Link className="table-action" href={"/superadmin/perusahaan/nusantara-kreatif" as Route}><Eye size={15} /></Link></td></tr>)}</tbody></table></div><div className="table-footer"><span>Menampilkan {rows.length} dari 248 perusahaan</span></div></section>
  </>;
}

function PlatformPlans() {
  const plans = [["Starter", "Rp 0", "25", "156"], ["Growth", "Rp 199.000", "100", "68"], ["Business", "Rp 499.000", "500", "24"]];
  return <><PageHead eyebrow="MONETISASI" title="Paket & Harga Platform" copy="Atur paket global, batas karyawan, harga, dan fitur yang tersedia untuk perusahaan." /><div className="platform-plan-grid">{plans.map((plan, index) => <article className={`module-card platform-plan ${index === 1 ? "featured" : ""}`} key={plan[0]}>{index === 1 ? <span className="recommended">PALING BANYAK DIGUNAKAN</span> : null}<span className="plan-icon"><CreditCard size={22} /></span><h2>{plan[0]}</h2><strong>{plan[1]}<small>/bulan</small></strong><p>Maksimal {plan[2]} karyawan</p><ul><li><CheckCircle2 size={15} />Kehadiran foto langsung</li><li><CheckCircle2 size={15} />Laporan dan dashboard</li><li><CheckCircle2 size={15} />Kontrol hak akses</li></ul><div><span>{plan[3]} perusahaan aktif</span><button className="btn btn-outline btn-block">Atur Paket</button></div></article>)}</div></>;
}

function PlatformSettings() {
  return <><PageHead eyebrow="KONFIGURASI GLOBAL" title="Pengaturan Platform" copy="Pengaturan ini berlaku untuk seluruh perusahaan dan hanya dapat diubah Super Admin." /><div className="settings-layout platform-settings"><aside className="module-card settings-menu"><button className="active"><Settings size={16} />Umum</button><button><CreditCard size={16} />Billing & Pajak</button><button><ShieldCheck size={16} />Keamanan</button><button><Activity size={16} />Batas Sistem</button></aside><section className="module-card settings-panel"><div className="settings-title"><span className="eyebrow">PENGATURAN GLOBAL</span><h2>Identitas dan operasional platform</h2><p>Perubahan memengaruhi seluruh tenant TepatWaktu.</p></div><div className="profile-form"><label className="field"><span>Nama Platform</span><input className="input" defaultValue="TepatWaktu" /></label><label className="field"><span>Email Dukungan</span><input className="input" defaultValue="support@tepatwaktu.id" /></label><label className="field"><span>Mata Uang</span><select className="input" defaultValue="IDR"><option>IDR</option></select></label><label className="field"><span>Zona Waktu Default</span><select className="input" defaultValue="Asia/Makassar"><option>Asia/Makassar</option></select></label></div><div className="form-footer"><button className="btn btn-primary">Simpan Pengaturan Global</button></div></section></div></>;
}

function CompanyDetail() {
  return <><PageHead eyebrow="DETAIL TENANT" title="Nusantara Kreatif" copy="Lihat identitas, penggunaan, langganan, dan kondisi perusahaan tanpa mengambil alih sesi pengguna." /><section className="detail-layout"><div className="detail-main"><div className="module-card detail-section"><div className="detail-section-head"><div><Building2 size={18} /><h2>Informasi Perusahaan</h2></div><span>AKTIF</span></div><div className="detail-grid">{[["Nama", "Nusantara Kreatif"], ["Industri", "Teknologi"], ["Admin", "admin@tepatwaktu.id"], ["Terdaftar", "12 Januari 2026"], ["Karyawan", "38 / 100"], ["Zona Waktu", "Asia/Makassar"]].map(([label, value]) => <div className="detail-field" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></div><div className="module-card detail-section"><div className="detail-section-head"><div><Activity size={18} /><h2>Aktivitas Terakhir</h2></div></div><div className="health-list"><Health label="Admin terakhir login" value="Hari ini, 08.12" /><Health label="Kehadiran tercatat bulan ini" value="712" /><Health label="Pengguna aktif" value="35" /></div></div></div><aside className="detail-side"><div className="module-card detail-action-card"><span className="eyebrow">LANGGANAN AKTIF</span><h2>Paket Growth</h2><p>Aktif sampai 28 Oktober 2026 dengan status pembayaran lunas.</p><button className="btn btn-primary btn-block">Kelola Langganan</button><button className="btn btn-outline btn-block">Lihat Audit Tenant</button></div><div className="module-card audit-mini"><ShieldCheck size={18} /><span><strong>Isolasi tenant aktif</strong><small>Semua tindakan Super Admin dicatat dan tidak mengubah sesi perusahaan.</small></span></div></aside></section></>;
}

function PageHead({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="product-page-header"><span className="breadcrumb">{eyebrow}</span><div><h1>{title}</h1><p>{copy}</p></div></header>; }
function PlatformStat({ icon, label, value, meta, tone }: { icon: React.ReactNode; label: string; value: string; meta: string; tone: string }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div></article>; }
function Health({ label, value }: { label: string; value: string }) { return <div><span><i /><strong>{label}</strong></span><b>{value}</b></div>; }
