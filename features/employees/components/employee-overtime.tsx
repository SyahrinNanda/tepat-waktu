"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

export type EmployeeOvertimeRow = { id: string; overtimeDate: string; startTime: string; endTime: string; durationMinutes: number; description: string; status: "pending" | "approved" | "rejected" };
type SortKey = "date" | "status";

const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const statusOrder = { pending: 0, approved: 1, rejected: 2 } as const;
const longDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const duration = (minutes: number) => [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} Jam` : "", minutes % 60 ? `${minutes % 60} Menit` : ""].filter(Boolean).join(" ") || "0 Menit";

function SortIcon({ sort, column }: { sort: { key: SortKey; desc: boolean }; column: SortKey }) {
  return sort.key !== column ? <ArrowUpDown size={12}/> : sort.desc ? <ArrowDown size={12}/> : <ArrowUp size={12}/>;
}

/** Daftar Lembur tab: the employee's overtime requests with month / year filters and sortable columns. */
export function EmployeeOvertime({ rows, today }: { rows: EmployeeOvertimeRow[]; today: string }) {
  const [currentYear, currentMonth] = today.split("-");
  const [month, setMonth] = useState(currentMonth), [year, setYear] = useState(currentYear);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: true });
  const years = useMemo(() => [...new Set([currentYear, ...rows.map((row) => row.overtimeDate.slice(0, 4))])].sort().reverse(), [rows, currentYear]);
  const visible = useMemo(() => rows
    .filter((row) => (!year || row.overtimeDate.startsWith(year)) && (!month || row.overtimeDate.slice(5, 7) === month))
    .sort((a, b) => {
      const order = sort.key === "date" ? `${a.overtimeDate}${a.startTime}`.localeCompare(`${b.overtimeDate}${b.startTime}`) : statusOrder[a.status] - statusOrder[b.status] || a.overtimeDate.localeCompare(b.overtimeDate);
      return sort.desc ? -order : order;
    }), [rows, month, year, sort]);
  const approvedMinutes = visible.filter((row) => row.status === "approved").reduce((total, row) => total + row.durationMinutes, 0);
  const toggle = (key: SortKey) => setSort((current) => ({ key, desc: current.key === key ? !current.desc : key === "date" }));
  const filtered = month !== currentMonth || year !== currentYear;

  return <div className="employee-tab-panel">
    <h3>Daftar Lembur Karyawan</h3>
    <div className="employee-visit-filters employee-overtime-filters">
      <label><span>Filter Bulan:</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Semua Bulan</option>{months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}</select></label>
      <label><span>Filter Tahun:</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Semua Tahun</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div><span>Atur Ulang Filter:</span><button type="button" className="btn btn-outline employee-tab-action" disabled={!filtered} onClick={() => { setMonth(currentMonth); setYear(currentYear); }}><RotateCcw size={15}/> Atur Ulang</button></div>
    </div>
    <div className="table-scroll"><table className="employee-tab-table employee-overtime-table">
      <thead><tr><th>#</th><th><button type="button" className="employee-sort" onClick={() => toggle("date")}>Tanggal Lembur <SortIcon sort={sort} column="date"/></button></th><th>Jam Mulai–Selesai</th><th>Durasi Lembur</th><th>Deskripsi Lembur</th><th><button type="button" className="employee-sort" onClick={() => toggle("status")}>Status <SortIcon sort={sort} column="status"/></button></th></tr></thead>
      <tbody>{visible.map((row, index) => <tr key={row.id}>
        <td>{index + 1}</td>
        <td>{longDate(row.overtimeDate)}</td>
        <td>{row.startTime.slice(0, 5)} – {row.endTime.slice(0, 5)}</td>
        <td>{duration(row.durationMinutes)}</td>
        <td className="employee-overtime-desc">{row.description || "-"}</td>
        <td><StatusBadge value={row.status}/></td>
      </tr>)}</tbody>
    </table>
    {!visible.length && <div className="location-empty"><strong>Data Kosong</strong><span>Tidak ada lembur pada {month ? months[Number(month) - 1] : "semua bulan"} {year || ""}.</span></div>}</div>
    {visible.length > 0 && <footer className="employee-tab-footer"><span>menampilkan {visible.length} data lembur</span><span>Total lembur disetujui: <strong>{duration(approvedMinutes)}</strong></span></footer>}
  </div>;
}
