"use client";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Ellipsis, Images, Inbox, MapPin, RotateCcw } from "lucide-react";
import { LocationModal } from "@/features/master-data/shared/location-modal";

export type EmployeeVisitRow = {
  id: string; visitDate: string; visitTime: string; locationName: string; contactName: string | null;
  note: string | null; status: string; latitude: number | null; longitude: number | null; attachments: string[];
};

const PAGE_SIZE = 10;
const dayName = (value: string) => new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const longDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const shortDate = (value: string) => value.split("-").reverse().join("-");
const shift = (date: string, days: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

/** Absen Kunjungan tab of the employee detail page: the employee's visits with a date-range filter. */
export function EmployeeVisits({ rows, from, to, today }: { rows: EmployeeVisitRow[]; from: string; to: string; today: string }) {
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams();
  const [page, setPage] = useState(1), [viewing, setViewing] = useState<EmployeeVisitRow | null>(null);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "kunjungan");
    if (nextFrom && nextTo) { params.set("from", nextFrom <= nextTo ? nextFrom : nextTo); params.set("to", nextFrom <= nextTo ? nextTo : nextFrom); } else { params.delete("from"); params.delete("to"); }
    setPage(1);
    router.push(`${pathname}?${params.toString()}` as Route, { scroll: false });
  }

  return <div className="employee-tab-panel">
    <h3>Data Kunjungan Karyawan</h3>
    <div className="employee-visit-filters">
      <div><span>Filter Tanggal Kunjungan:</span><DateRangePicker from={from} to={to} today={today} onApply={apply}/></div>
      <div><span>Atur Ulang Filter:</span><button type="button" className="btn btn-outline employee-tab-action" disabled={!from} onClick={() => apply("", "")}><RotateCcw size={15}/> Atur Ulang</button></div>
    </div>
    <div className="table-scroll"><table className="employee-tab-table employee-visit-table">
      <thead><tr><th>#</th><th>Hari / Tanggal</th><th>Lokasi Kunjungan</th><th>Nama</th><th>Jam Kunjungan</th><th>Keterangan</th><th>Lampiran</th><th aria-label="Aksi"/></tr></thead>
      <tbody>{visible.map((row, index) => <tr key={row.id}>
        <td>{(current - 1) * PAGE_SIZE + index + 1}</td>
        <td>{dayName(row.visitDate)} / {longDate(row.visitDate)}</td>
        <td className="accent">{row.locationName}</td>
        <td className="accent">{row.contactName || "–"}</td>
        <td>{row.visitTime.slice(0, 8)}</td>
        <td>{row.note || "-"}</td>
        <td>{row.attachments.length ? <button type="button" className="employee-link-button" onClick={() => setViewing(row)}>Lihat Lampiran</button> : "–"}</td>
        <td><details className="employee-row-menu"><summary aria-label="Aksi kunjungan"><Ellipsis size={18}/></summary><div data-float-menu>
          {row.attachments.length > 0 && <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setViewing(row); }}><Images size={15}/> Lihat Lampiran</button>}
          {row.latitude != null && row.longitude != null ? <a href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`} target="_blank" rel="noreferrer"><MapPin size={15}/> Lihat di Peta</a> : <span className="muted">Tanpa koordinat</span>}
        </div></details></td>
      </tr>)}</tbody>
    </table>
    {!rows.length && <div className="employee-visit-empty"><Inbox size={40}/><strong>Data Kosong</strong><span>{from ? `Tidak ada kunjungan pada ${shortDate(from)} s.d. ${shortDate(to)}.` : "Karyawan ini belum memiliki data kunjungan."}</span></div>}</div>
    {rows.length > 0 && <footer className="employee-tab-footer"><span>menampilkan {visible.length} dari {rows.length} data</span>
      <nav><button type="button" aria-label="Sebelumnya" disabled={current <= 1} onClick={() => setPage(current - 1)}><ArrowLeft size={16}/></button>
        {Array.from({ length: pages }, (_, index) => index + 1).filter((item) => Math.abs(item - current) <= 2 || item === 1 || item === pages).map((item) => <button type="button" key={item} className={item === current ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}
        <button type="button" aria-label="Berikutnya" disabled={current >= pages} onClick={() => setPage(current + 1)}><ArrowRight size={16}/></button></nav>
    </footer>}
    {viewing && <LocationModal title={`Lampiran Kunjungan · ${viewing.locationName}`} onClose={() => setViewing(null)}>
      <div className="employee-visit-gallery">{viewing.attachments.map((id, index) => <a key={id} href={`/api/files/${id}`} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- private files are served by our own API */}
        <img src={`/api/files/${id}`} alt={`Lampiran ${index + 1}`} loading="lazy"/></a>)}</div>
      <p className="employee-visit-gallery-meta">{dayName(viewing.visitDate)}, {longDate(viewing.visitDate)} · {viewing.visitTime.slice(0, 5)}{viewing.note ? ` · ${viewing.note}` : ""}</p>
    </LocationModal>}
  </div>;
}

function DateRangePicker({ from, to, today, onApply }: { from: string; to: string; today: string; onApply: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false), [draftFrom, setDraftFrom] = useState(from || today), [draftTo, setDraftTo] = useState(to || today);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const monthStart = `${today.slice(0, 8)}01`;
  const presets: [string, string, string][] = [["Hari Ini", today, today], ["Kemarin", shift(today, -1), shift(today, -1)], ["7 Hari Terakhir", shift(today, -6), today], ["30 Hari Terakhir", shift(today, -29), today], ["Bulan Ini", monthStart, today]];
  const pick = (start: string, end: string) => { setOpen(false); onApply(start, end); };
  return <div className="employee-date-range" ref={box}>
    <button type="button" className="employee-date-range-input" onClick={() => { setDraftFrom(from || today); setDraftTo(to || today); setOpen((value) => !value); }}>
      <span><CalendarDays size={15}/></span>{from ? `${shortDate(from)}  –  ${shortDate(to)}` : <em>Filter Tanggal</em>}
    </button>
    {open && <div className="employee-date-range-pop">
      <ul>{presets.map(([label, start, end]) => <li key={label}><button type="button" className={from === start && to === end ? "active" : ""} onClick={() => pick(start, end)}>{label}</button></li>)}<li><button type="button" className="custom">Custom Range</button></li></ul>
      <div className="employee-date-range-custom">
        <label>Dari Tanggal<input type="date" value={draftFrom} max={draftTo || undefined} onChange={(event) => setDraftFrom(event.target.value)}/></label>
        <label>Sampai Tanggal<input type="date" value={draftTo} min={draftFrom || undefined} onChange={(event) => setDraftTo(event.target.value)}/></label>
        <footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Batal</button><button type="button" className="btn btn-primary btn-sm" disabled={!draftFrom || !draftTo} onClick={() => pick(draftFrom, draftTo)}>Terapkan</button></footer>
      </div>
    </div>}
  </div>;
}
