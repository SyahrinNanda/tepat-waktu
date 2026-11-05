"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, EyeOff, Inbox, Megaphone, RotateCcw, Search } from "lucide-react";
import { categoryKeys, categoryLabels, statusKeys, statusLabels, statusTone } from "../config";
import type { HandlerComplaint, ReporterComplaint } from "../server/complaint-service";
import { ComplaintForm } from "./complaint-form";

const formatDate = (value: Date | string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

export function ComplaintHeader({ title, description }: { title: string; description: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Beranda / Karyawan / Keluhan Karyawan</span><h1>{title}</h1><p>{description}</p></div><button className="btn btn-primary btn-compact" onClick={() => setOpen(true)}><Megaphone size={15}/> Buat Laporan</button></header>
    {open && <ComplaintForm onClose={() => setOpen(false)}/>}
  </>;
}

export function ComplaintStatusPill({ status }: { status: keyof typeof statusLabels }) {
  return <span className={`status-pill ${statusTone[status]}`}><i/>{statusLabels[status]}</span>;
}

export function ComplaintTable({ rows }: { rows: HandlerComplaint[] }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [status, setStatus] = useState("");
  const filtered = useMemo(() => rows.filter((row) =>
    `${row.ticketCode} ${row.title} ${row.reporterName ?? ""}`.toLowerCase().includes(query.toLowerCase())
    && (!category || row.category === category) && (!status || row.status === status)), [rows, query, category, status]);
  return <section className="module-card complaint-table-card">
    <div className="card-heading-row"><div><span className="eyebrow">Data laporan</span><h2>Semua laporan keluhan</h2></div></div>
    <div className="complaint-toolbar">
      <div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, judul, atau pelapor..."/></div>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter jenis"><option value="">Semua jenis</option>{categoryKeys.map((key) => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status"><option value="">Semua status</option>{statusKeys.map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}</select>
      <button className="btn btn-outline btn-compact" onClick={() => { setQuery(""); setCategory(""); setStatus(""); }} aria-label="Reset filter"><RotateCcw size={15}/></button>
    </div>
    {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Kode</th><th>Tanggal</th><th>Jenis</th><th>Judul</th><th>Pelapor</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>
      <td><strong>{row.ticketCode}</strong></td>
      <td>{formatDate(row.createdAt)}</td>
      <td>{categoryLabels[row.category]}</td>
      <td className="complaint-title-cell">{row.title}</td>
      <td>{row.anonymous ? <span className="complaint-anon-tag"><EyeOff size={13}/> Anonim</span> : row.reporterName}</td>
      <td><ComplaintStatusPill status={row.status}/></td>
      <td><Link className="btn btn-outline btn-xs" href={`/dashboard/karyawan/keluhan/${row.id}`}>Tangani <ChevronRight size={13}/></Link></td>
    </tr>)}</tbody></table></div> : <div className="empty-state tenant-empty"><Inbox size={28}/><strong>Tidak ada laporan</strong><span>{rows.length ? "Tidak ada laporan yang cocok dengan filter." : "Belum ada keluhan yang dilaporkan."}</span></div>}
  </section>;
}

export function OwnComplaintList({ rows }: { rows: ReporterComplaint[] }) {
  return <section className="module-card complaint-table-card">
    <div className="card-heading-row"><div><span className="eyebrow">Riwayat</span><h2>Laporan saya</h2><p className="card-subtitle">Hanya Anda yang dapat melihat daftar ini. Laporan anonim tidak menyimpan nama Anda.</p></div></div>
    {rows.length ? <ul className="complaint-own-list">{rows.map((row) => <li key={row.id}><Link href={`/dashboard/karyawan/keluhan/${row.id}`}>
      <span><strong>{row.title}</strong><small>{row.ticketCode} · {categoryLabels[row.category]} · {formatDate(row.createdAt)}{row.anonymous ? " · Anonim" : ""}</small></span>
      <ComplaintStatusPill status={row.status}/>
      <ChevronRight size={16}/>
    </Link></li>)}</ul> : <div className="empty-state tenant-empty"><Inbox size={28}/><strong>Belum ada laporan</strong><span>Jika Anda mengalami atau melihat perlakuan tidak pantas di tempat kerja, Anda dapat melaporkannya di sini.</span></div>}
  </section>;
}
