"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Inbox, Loader2, RotateCcw, Search } from "lucide-react";
import type { VisitReportRow } from "@/features/visits/types";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

type Period = "day" | "week" | "month";

type Props = {
  rows: VisitReportRow[];
  initialPeriod: Period;
  initialWeek: number;
  initialMonth: number;
  initialYear: number;
  initialDate: string;
  from: string;
  to: string;
};

export function VisitReportManager({
  rows,
  initialPeriod,
  initialWeek,
  initialMonth,
  initialYear,
  initialDate,
  from,
  to,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [week, setWeek] = useState(initialWeek);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [date, setDate] = useState(initialDate);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("az");
  const [exporting, setExporting] = useState(false);

  const updateURL = (newPeriod: Period, newWeek: number, newMonth: number, newYear: number, newDate: string) => {
    const params = new URLSearchParams();
    params.set("period", newPeriod);
    if (newPeriod === "week") {
      params.set("week", String(newWeek));
      params.set("month", String(newMonth));
      params.set("year", String(newYear));
    } else if (newPeriod === "month") {
      params.set("month", String(newMonth));
      params.set("year", String(newYear));
    } else {
      params.set("date", newDate);
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleTabChange = (p: Period) => {
    setPeriod(p);
    updateURL(p, week, month, year, date);
  };

  const handleWeekChange = (w: number) => {
    setWeek(w);
    updateURL(period, w, month, year, date);
  };

  const handleMonthChange = (m: number) => {
    setMonth(m);
    updateURL(period, week, m, year, date);
  };

  const handleYearChange = (y: number) => {
    setYear(y);
    updateURL(period, week, month, y, date);
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    updateURL(period, week, month, year, d);
  };

  const handleReset = () => {
    setQuery("");
    setSort("az");
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curDay = now.getDate();
    const curWeek = curDay <= 7 ? 1 : curDay <= 14 ? 2 : curDay <= 21 ? 3 : 4;
    setWeek(curWeek);
    setMonth(curMonth);
    setYear(curYear);
    updateURL(period, curWeek, curMonth, curYear, initialDate);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/visits/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Gagal mengunduh laporan Excel.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-kunjungan-${period}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Gagal mengunduh laporan Excel.");
    } finally {
      setExporting(false);
    }
  };

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!query.trim()) return true;
      const term = query.toLowerCase();
      return (
        r.employeeName.toLowerCase().includes(term) ||
        r.employeeCode.toLowerCase().includes(term) ||
        r.outlets.some((o) => o.toLowerCase().includes(term))
      );
    });

    return filtered.sort((a, b) => {
      if (sort === "za") return b.employeeName.localeCompare(a.employeeName);
      if (sort === "most") return b.visitCount - a.visitCount;
      if (sort === "least") return a.visitCount - b.visitCount;
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [rows, query, sort]);

  return (
    <>
      <header className="visit-report-head">
        <small>Kehadiran Admin Panel</small>
        <h1>LAPORAN KUNJUNGAN</h1>
        <p>Beranda &nbsp;/ &nbsp;Kunjungan &nbsp;/ &nbsp;Laporan Kunjungan</p>
      </header>

      <section className="visit-report-card">
        <h2>Laporan Kunjungan</h2>

        <div className="visit-report-body">
          {/* TABS: Hari, Minggu, Bulan */}
          <nav className="visit-report-tabs">
            <button
              type="button"
              className={period === "day" ? "active" : ""}
              onClick={() => handleTabChange("day")}
            >
              Hari
            </button>
            <button
              type="button"
              className={period === "week" ? "active" : ""}
              onClick={() => handleTabChange("week")}
            >
              Minggu
            </button>
            <button
              type="button"
              className={period === "month" ? "active" : ""}
              onClick={() => handleTabChange("month")}
            >
              Bulan
            </button>
          </nav>

          {/* TOOLBAR */}
          <div className="visit-report-toolbar">
            {/* Search */}
            <label className="visit-search report">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama karyawan ..."
              />
            </label>

            {/* TAB MINGGUAN FILTERS (Gambar 3 - 6) */}
            {period === "week" && (
              <>
                {/* Dropdown Minggu (Gambar 3) */}
                <select
                  value={week}
                  onChange={(e) => handleWeekChange(parseInt(e.target.value, 10))}
                  aria-label="Pilih Minggu"
                  className="visit-report-select week"
                >
                  <option value={1}>Minggu 1</option>
                  <option value={2}>Minggu 2</option>
                  <option value={3}>Minggu 3</option>
                  <option value={4}>Minggu 4</option>
                </select>

                {/* Dropdown Bulan (Gambar 4) */}
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                  aria-label="Pilih Bulan"
                  className="visit-report-select month"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Dropdown Tahun (Gambar 5) */}
                <select
                  value={year}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  aria-label="Pilih Tahun"
                  className="visit-report-select year"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* TAB BULANAN FILTERS (Gambar 7 - 9) */}
            {period === "month" && (
              <>
                {/* Dropdown Bulan (Gambar 7) */}
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                  aria-label="Pilih Bulan"
                  className="visit-report-select month-full"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Dropdown Tahun (Gambar 8) */}
                <select
                  value={year}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  aria-label="Pilih Tahun"
                  className="visit-report-select year"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* TAB HARIAN FILTER */}
            {period === "day" && (
              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="visit-report-date-input"
                aria-label="Pilih Tanggal"
              />
            )}

            {/* Dropdown Sorting A-Z (Gambar 6 & Gambar 9) */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Urutkan laporan"
              className="visit-report-select sort"
            >
              <option value="az">A - Z</option>
              <option value="za">Z - A</option>
              <option value="most">Kunjungan Terbanyak</option>
              <option value="least">Kunjungan Tersedikit</option>
            </select>

            {/* Reset Button */}
            <button
              type="button"
              className="visit-report-reset"
              title="Reset filter"
              onClick={handleReset}
            >
              <RotateCcw size={17} />
            </button>

            <span className="visit-report-spacer" />

            {/* Export Excel Button */}
            <button
              type="button"
              className="visit-report-export-btn"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Download size={16} />
              )}
              Export Excel
            </button>
          </div>

          {/* TABLE OR EMPTY STATE */}
          <div className="visit-table-wrap">
            {visible.length > 0 ? (
              <table className="visit-table report">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Nomor Induk</th>
                    <th>Jumlah Kunjungan</th>
                    <th>Selesai</th>
                    <th>Kunjungan Terakhir</th>
                    <th>Outlet</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <strong>{row.employeeName}</strong>
                      </td>
                      <td>{row.employeeCode}</td>
                      <td>{row.visitCount}</td>
                      <td>{row.completedCount}</td>
                      <td>{row.lastVisitDate ? formatDate(row.lastVisitDate) : "—"}</td>
                      <td>{row.outlets.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* EMPTY STATE (Gambar 3 - 9) */
              <div className="visit-empty-container">
                <div className="visit-empty-illustration">
                  <div className="visit-empty-cloud"></div>
                  <div className="visit-empty-box">
                    <Inbox size={46} />
                  </div>
                </div>
                <strong className="visit-empty-title">Data Kosong</strong>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
