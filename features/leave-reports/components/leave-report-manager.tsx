"use client";

import Image from "next/image";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, CircleUserRound, Download, Ellipsis, RotateCcw, Save, Search, Settings2 } from "lucide-react";
import { LocationModal } from "@/features/master-data/shared/location-modal";
import { saveLeaveEntitlement, saveLeaveRules, type LeaveActionResult } from "@/features/leave-reports/server/actions";
import { describeLeaveRules, shiftDate, type AnnualLeaveBalance, type AnnualLeaveRules } from "@/features/leave-requests/annual-leave";

export type LeaveTally = { times: number; days: number };
export type LeaveReportRow = {
  id: string; employeeCode: string; name: string; email: string; department: string; position: string; status: "active" | "inactive";
  joinedAt: string; photoAssetId: string | null; balance: AnnualLeaveBalance;
  annual: LeaveTally; sick: LeaveTally; permission: LeaveTally; special: (LeaveTally & { name: string })[];
};

const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const tallyText = (tally: LeaveTally) => (tally.times ? `${tally.times}x · ${tally.days} hari` : "-");

/** Laporan Cuti: Cuti Tahunan balance per employee period (resets on the work anniversary) and a rekap of a date range. */
export function LeaveReportManager({ initialRows, rules, from, to, today, canManage }: { initialRows: LeaveReportRow[]; rules: AnnualLeaveRules; from: string; to: string; today: string; canManage: boolean }) {
  const router = useRouter(), pathname = usePathname();
  const [query, setQuery] = useState(""), [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("active");
  const [draftFrom, setDraftFrom] = useState(from), [draftTo, setDraftTo] = useState(to);
  const [editing, setEditing] = useState<LeaveReportRow | null>(null), [editingRules, setEditingRules] = useState(false);
  const rows = useMemo(() => initialRows.filter((row) => (!statusFilter || row.status === statusFilter) && `${row.name} ${row.email} ${row.employeeCode}`.toLowerCase().includes(query.toLowerCase())), [initialRows, query, statusFilter]);
  const year = today.slice(0, 4), monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = shiftDate(`${new Date(Date.UTC(Number(year), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10)}`, -1);
  const presets: [string, string, string][] = [["Bulan Ini", monthStart, monthEnd], ["Tahun Ini", `${year}-01-01`, `${year}-12-31`], ["Tahun Lalu", `${Number(year) - 1}-01-01`, `${Number(year) - 1}-12-31`]];
  const apply = (nextFrom: string, nextTo: string) => { setDraftFrom(nextFrom); setDraftTo(nextTo); router.push(`${pathname}?from=${nextFrom}&to=${nextTo}` as Route); };
  const range = `${formatDate(from)} – ${formatDate(to)}`;

  function exportCsv() {
    const header = ["NIK", "Nama", "Jabatan", "Divisi", "Tanggal Bergabung", "Periode Cuti Mulai", "Periode Cuti Selesai", "Reset Berikutnya", "Jatah", "Bawaan", "Terpakai", "Menunggu", "Sisa", `Cuti Tahunan (${from} s.d. ${to})`, "Izin (kali)", "Izin (hari)", "Sakit (kali)", "Sakit (hari)", "Cuti Khusus"];
    const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = rows.map((row) => [row.employeeCode, row.name, row.position, row.department, row.joinedAt, row.balance.start, row.balance.end, row.balance.nextReset, row.balance.entitled, row.balance.carried, row.balance.used, row.balance.pending, Math.max(row.balance.available, 0), row.annual.days, row.permission.times, row.permission.days, row.sick.times, row.sick.days, row.special.map((item) => `${item.name} ${item.times}x/${item.days} hari`).join("; ")].map(quote).join(","));
    const url = URL.createObjectURL(new Blob([`﻿${header.map(quote).join(",")}\r\n${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `laporan-cuti-${from}-sd-${to}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <>
    <div className="master-page-head leave-report-head"><span>TepatWaktu Admin Panel</span><h1>Laporan Cuti</h1></div>
    <section className="leave-report-card">
      <div className="leave-report-bar">
        <div className="master-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama Karyawan..."/></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Status karyawan"><option value="active">Karyawan Aktif</option><option value="inactive">Belum Aktif</option><option value="">Semua Karyawan</option></select>
        <span className="leave-report-spacer"/>
        {canManage && <button type="button" className="btn btn-outline leave-report-action" onClick={() => setEditingRules(true)}><Settings2 size={15}/> Aturan Cuti</button>}
        <button type="button" className="btn btn-primary leave-report-action" onClick={exportCsv}><Download size={15}/> Ekspor Excel</button>
      </div>
      <form className="leave-report-range" onSubmit={(event) => { event.preventDefault(); if (draftFrom && draftTo) apply(draftFrom <= draftTo ? draftFrom : draftTo, draftFrom <= draftTo ? draftTo : draftFrom); }}>
        <span className="leave-report-range-label"><CalendarRange size={16}/> Periode Rekap</span>
        <label>Dari<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} required/></label>
        <label>Sampai<input type="date" value={draftTo} min={draftFrom} onChange={(event) => setDraftTo(event.target.value)} required/></label>
        <button className="btn btn-primary leave-report-action">Terapkan</button>
        <div className="leave-report-presets">{presets.map(([label, start, end]) => <button type="button" key={label} className={from === start && to === end ? "active" : ""} onClick={() => apply(start, end)}>{label}</button>)}</div>
        <button type="button" className="leave-report-reset" onClick={() => apply(`${year}-01-01`, `${year}-12-31`)}><RotateCcw size={14}/> Atur Ulang</button>
      </form>
      <p className="leave-report-rules"><strong>Aturan cuti tahunan:</strong> {describeLeaveRules(rules)}. Jatah tiap karyawan direset otomatis setiap tanggal ulang tahun kerjanya (tanggal bergabung).</p>
      <div className="table-scroll"><table className="leave-report-table leave-report-table-v2">
        <thead>
          <tr className="leave-report-groups"><th colSpan={4}/><th colSpan={5}>Cuti Tahunan · periode berjalan (per {formatDate(today)})</th><th colSpan={4}>Rekap {range}</th><th/></tr>
          <tr><th>#</th><th>Foto</th><th>Nama Karyawan</th><th>Jabatan–Divisi</th><th>Periode &amp; Reset</th><th>Jatah</th><th>Terpakai</th><th>Menunggu</th><th>Sisa</th><th>Cuti Tahunan</th><th>Izin</th><th>Sakit</th><th>Cuti Khusus</th><th/></tr>
        </thead>
        <tbody>{rows.map((row, index) => {
          const balance = row.balance, available = Math.max(balance.available, 0);
          return <tr key={row.id}>
            <td>{index + 1}</td>
            <td>{row.photoAssetId ? <Image className="leave-avatar" src={`/api/files/${row.photoAssetId}`} width={48} height={48} unoptimized alt={`Foto ${row.name}`}/> : <CircleUserRound className="leave-avatar-placeholder"/>}</td>
            <td>{row.status === "inactive" && <span className="leave-inactive">Karyawan Belum Aktif</span>}<small className="leave-code">NI: {row.employeeCode}</small><strong>{row.name}</strong><small>Bergabung {formatDate(row.joinedAt)}</small></td>
            <td><strong>{row.position}</strong><small>{row.department}</small></td>
            <td><strong>{formatDate(balance.start)} – {formatDate(balance.end)}</strong><small>Reset {formatDate(balance.nextReset)}</small></td>
            <td><strong>{balance.entitled}</strong>{balance.carried > 0 && <small>{balance.base} + {balance.carried} bawaan</small>}{!balance.eligible && <small>Mulai {formatDate(balance.eligibleFrom)}</small>}</td>
            <td>{balance.used}</td>
            <td>{balance.pending || "-"}</td>
            <td><span className={`leave-remaining ${available === 0 ? "empty" : available <= 3 ? "low" : ""}`}>{available}</span></td>
            <td>{tallyText(row.annual)}</td>
            <td>{tallyText(row.permission)}</td>
            <td>{tallyText(row.sick)}</td>
            <td className="leave-special-cell">{row.special.length ? row.special.map((item) => <span key={item.name}><strong>{item.name}</strong><small>{item.times}x · {item.days} hari kerja</small></span>) : <small>-</small>}</td>
            <td>{canManage && <details className="employee-row-menu"><summary aria-label={`Aksi ${row.name}`}><Ellipsis size={18}/></summary><div data-float-menu>
              <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setEditing(row); }}><Settings2 size={15}/> Ubah Jatah Periode Ini</button>
            </div></details>}</td>
          </tr>;
        })}</tbody>
      </table>{!rows.length && <div className="salary-empty">Data karyawan tidak ditemukan.</div>}</div>
      <footer>menampilkan {rows.length} dari {initialRows.length} data. Jumlah hari dihitung dalam hari kerja sesuai jadwal divisi karyawan.</footer>
    </section>
    {editing && <EntitlementModal row={editing} rules={rules} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }}/>}
    {editingRules && <RulesModal rules={rules} onClose={() => setEditingRules(false)} onSaved={() => { setEditingRules(false); router.refresh(); }}/>}
  </>;
}

function useAction() {
  const [error, setError] = useState(""), [pending, start] = useTransition();
  const run = (action: () => Promise<LeaveActionResult>, onDone: () => void) => {
    setError("");
    start(async () => {
      const result = await action().catch(() => ({ ok: false, error: "Server tidak dapat dihubungi." }) as LeaveActionResult);
      if (result.ok) onDone(); else setError(result.error);
    });
  };
  return { error, pending, run };
}

function EntitlementModal({ row, rules, onClose, onSaved }: { row: LeaveReportRow; rules: AnnualLeaveRules; onClose: () => void; onSaved: () => void }) {
  const balance = row.balance, periodYear = Number(balance.start.slice(0, 4));
  const ruleDays = balance.eligible || rules.eligibility === "immediate" ? rules.days : 0;
  const [days, setDays] = useState(String(balance.base)), { error, pending, run } = useAction();
  const value = Number(days);
  return <LocationModal title="Ubah Jatah Cuti Tahunan" onClose={onClose}>
    <form className="leave-entitlement-form" onSubmit={(event) => { event.preventDefault(); run(() => saveLeaveEntitlement({ employeeId: row.id, year: periodYear, maximumDays: value }), onSaved); }}>
      <div className="leave-modal-body">
      <dl className="leave-entitlement-info">
        <div><dt>Karyawan</dt><dd>{row.name}</dd></div>
        <div><dt>Periode</dt><dd>{formatDate(balance.start)} – {formatDate(balance.end)} (reset {formatDate(balance.nextReset)})</dd></div>
        <div><dt>Aturan perusahaan</dt><dd>{ruleDays} hari kerja{!balance.eligible ? " (belum genap 12 bulan kerja)" : ""}</dd></div>
        <div><dt>Terpakai / menunggu</dt><dd>{balance.used} / {balance.pending} hari kerja</dd></div>
        {balance.carried > 0 && <div><dt>Bawaan periode lalu</dt><dd>{balance.carried} hari kerja</dd></div>}
      </dl>
      <label>Jatah periode ini (hari kerja)<input type="number" min={0} max={365} value={days} onChange={(event) => setDays(event.target.value)} required autoFocus/></label>
      <p className="drawer-help">Hanya berlaku untuk periode ini. Periode berikutnya kembali mengikuti aturan perusahaan.{balance.carried > 0 ? ` Sisa bawaan ${balance.carried} hari tetap ditambahkan.` : ""}</p>
      {error && <div className="announcement-inline-error">{error}</div>}
      </div>
      <footer>
        <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => saveLeaveEntitlement({ employeeId: row.id, year: periodYear, maximumDays: null }), onSaved)}>Ikuti Aturan Perusahaan</button>
        <span/>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Batal</button>
        <button className="btn btn-primary btn-sm" disabled={pending || days === "" || value < 0}><Save size={14}/> {pending ? "Menyimpan..." : "Simpan"}</button>
      </footer>
    </form>
  </LocationModal>;
}

function RulesModal({ rules, onClose, onSaved }: { rules: AnnualLeaveRules; onClose: () => void; onSaved: () => void }) {
  const [days, setDays] = useState(String(rules.days)), [eligibility, setEligibility] = useState(rules.eligibility);
  const [carryOver, setCarryOver] = useState(rules.carryOver), [carryOverMax, setCarryOverMax] = useState(rules.carryOverMax ? String(rules.carryOverMax) : "");
  const { error, pending, run } = useAction();
  return <LocationModal title="Aturan Cuti Tahunan" onClose={onClose}>
    <form className="leave-rules-form" onSubmit={(event) => { event.preventDefault(); run(() => saveLeaveRules({ days: Number(days), eligibility, carryOver, carryOverMax: carryOver && carryOverMax.trim() ? Number(carryOverMax) : null }), onSaved); }}>
      <div className="leave-modal-body">
      <p className="leave-rules-intro">Setiap karyawan punya periode cuti sendiri yang dimulai dari <strong>tanggal bergabung</strong>. Jatah direset otomatis setiap ulang tahun kerjanya. Contoh: bergabung 15 Maret, maka periodenya 15 Maret – 14 Maret tahun berikutnya. Cuti dihitung dalam <strong>hari kerja</strong> sesuai jadwal divisi.</p>
      <label>Jatah cuti per periode (hari kerja)<input type="number" min={0} max={60} value={days} onChange={(event) => setDays(event.target.value)} required/></label>
      <fieldset><legend>Karyawan baru mulai berhak cuti</legend>
        <label className="leave-rules-option"><input type="radio" name="eligibility" checked={eligibility === "immediate"} onChange={() => setEligibility("immediate")}/><span><strong>Langsung sejak tanggal bergabung</strong><small>Jatah penuh tersedia sejak hari pertama bekerja.</small></span></label>
        <label className="leave-rules-option"><input type="radio" name="eligibility" checked={eligibility === "after_one_year"} onChange={() => setEligibility("after_one_year")}/><span><strong>Setelah 12 bulan kerja</strong><small>Sesuai UU Ketenagakerjaan: tahun pertama belum ada jatah cuti tahunan.</small></span></label>
      </fieldset>
      <fieldset><legend>Sisa cuti saat periode direset</legend>
        <label className="leave-rules-option"><input type="radio" name="carry" checked={!carryOver} onChange={() => setCarryOver(false)}/><span><strong>Hangus</strong><small>Periode baru mulai dari jatah penuh lagi.</small></span></label>
        <label className="leave-rules-option"><input type="radio" name="carry" checked={carryOver} onChange={() => setCarryOver(true)}/><span><strong>Dibawa ke periode berikutnya</strong><small>Sisa ditambahkan ke jatah periode baru.</small></span></label>
        {carryOver && <label className="leave-rules-max">Maksimal sisa yang dibawa (hari kerja)<input type="number" min={1} max={60} value={carryOverMax} placeholder="Kosong = tanpa batas" onChange={(event) => setCarryOverMax(event.target.value)}/></label>}
      </fieldset>
      <p className="drawer-help">Perubahan berlaku langsung untuk semua karyawan, termasuk perhitungan sisa cuti periode berjalan. Jatah khusus per karyawan (Ubah Jatah Periode Ini) tetap dipakai.</p>
      {error && <div className="announcement-inline-error">{error}</div>}
      </div>
      <footer><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Batal</button><button className="btn btn-primary btn-sm" disabled={pending || days === ""}><Save size={14}/> {pending ? "Menyimpan..." : "Simpan Aturan"}</button></footer>
    </form>
  </LocationModal>;
}
