"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Inbox,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Search,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  formatMinutesWeb,
  type MonthlyEmployeeSummary,
} from "@/features/attendance/types/monthly";

export type LocationOption = { id: string; name: string };
export type DivisionOption = { id: string; name: string };
export type ShiftOption = { id: string; name: string; startTime: string; endTime: string };

type Props = {
  initialYear: number;
  initialMonth: number;
  initialQuery?: string;
  initialLocationId?: string;
  initialDivision?: string;
  initialShiftId?: string;
  locations: LocationOption[];
  divisions: DivisionOption[];
  shifts: ShiftOption[];
  summaries: MonthlyEmployeeSummary[];
};

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

export function MonthlyAttendanceManager({
  initialYear,
  initialMonth,
  initialQuery = "",
  initialLocationId = "",
  initialDivision = "",
  initialShiftId = "",
  locations,
  divisions,
  shifts,
  summaries,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Filter States
  const [query, setQuery] = useState(initialQuery);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [selectedLocation, setSelectedLocation] = useState(initialLocationId);
  const [selectedDivision, setSelectedDivision] = useState(initialDivision);
  const [selectedShift, setSelectedShift] = useState(initialShiftId);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Segmented Pill: "all", "masuk", "belum_keluar"
  const [activeTab, setActiveTab] = useState<"masuk" | "belum_keluar">("masuk");

  // Dropdown menu state
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Global notice
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Click outside to close dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApplyFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    if (query) params.set("q", query);
    else params.delete("q");

    if (selectedLocation) params.set("locationId", selectedLocation);
    else params.delete("locationId");

    if (selectedDivision) params.set("division", selectedDivision);
    else params.delete("division");

    if (selectedShift) params.set("shiftId", selectedShift);
    else params.delete("shiftId");

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
    setFilterPanelOpen(false);
  };

  const handleReset = () => {
    const now = new Date();
    setQuery("");
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setSelectedLocation("");
    setSelectedDivision("");
    setSelectedShift("");
    setFilterPanelOpen(false);
    setActiveTab("masuk");

    startTransition(() => {
      router.push(`/dashboard/presensi/bulanan?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
    });
  };

  // Filtered rows by client-side segmented pills
  const filteredSummaries = useMemo(() => {
    return summaries.filter((item) => {
      if (activeTab === "belum_keluar") {
        return item.hasCheckedInTodayWithoutCheckOut;
      }
      return true; // Tab "Masuk" shows all active attendees
    });
  }, [summaries, activeTab]);

  // Handle Import submission (matching Gambar 4)
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportNotice({ type: "error", message: "Silakan pilih file Excel terlebih dahulu." });
      return;
    }

    setImportLoading(true);
    setImportNotice(null);

    try {
      const formData = new FormData();
      formData.set("file", importFile);

      const res = await fetch("/api/attendance/admin/monthly/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengimpor data presensi.");
      }

      setNotice({ type: "success", message: data.message || "Presensi berhasil diimpor." });
      setImportModalOpen(false);
      setImportFile(null);
      router.refresh();
    } catch (err: unknown) {
      setImportNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat import.",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    if (query) params.set("q", query);
    if (selectedLocation) params.set("locationId", selectedLocation);
    if (selectedDivision) params.set("division", selectedDivision);
    if (selectedShift) params.set("shiftId", selectedShift);
    return `/api/attendance/admin/monthly/export?${params.toString()}`;
  }, [year, month, query, selectedLocation, selectedDivision, selectedShift]);

  // Available year options around current year
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur - 2, cur - 1, cur, cur + 1, cur + 2];
  }, []);

  return (
    <div className="monthly-attendance-container">
      {/* Header Eyebrow, Title & Breadcrumb matching Gambar 1 */}
      <header className="monthly-attendance-header">
        <div className="monthly-attendance-eyebrow">Presensi Admin Panel</div>
        <div className="monthly-attendance-title-row">
          <h1 className="monthly-attendance-title">LAPORAN PRESENSI BULANAN</h1>
          <nav className="monthly-attendance-breadcrumb">
            <Link href="/dashboard">Beranda</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/dashboard/presensi/harian">Presensi</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Laporan Presensi Bulanan</span>
          </nav>
        </div>
      </header>

      {/* Global Alert Notice */}
      {notice ? (
        <div className={`monthly-attendance-alert ${notice.type}`}>
          {notice.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Main Filter & Content Card matching Gambar 1 */}
      <section className="monthly-attendance-card">
        {/* ROW 1: Search, Month, Year, Filter, Reset & ... Dropdown */}
        <div className="monthly-toolbar-row-1">
          {/* Search Box */}
          <div className="monthly-search-box">
            <Search size={15} className="monthly-search-icon" />
            <input
              type="text"
              placeholder="Nomor Induk atau Nama Karyawan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyFilter();
              }}
              className="monthly-search-input"
            />
            {query ? (
              <button
                type="button"
                className="monthly-search-clear"
                onClick={() => setQuery("")}
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Month Dropdown */}
          <div className="monthly-month-wrap">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="monthly-select-month"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Dropdown */}
          <div className="monthly-year-wrap">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="monthly-select-year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Button */}
          <button
            type="button"
            className={`monthly-action-btn monthly-filter-btn ${filterPanelOpen ? "active" : ""}`}
            onClick={() => filterPanelOpen ? handleApplyFilter() : setFilterPanelOpen(true)}
            title={filterPanelOpen ? "Terapkan dan Tutup Filter" : "Buka Filter"}
            aria-expanded={filterPanelOpen}
            aria-controls="monthly-advanced-filters"
          >
            <Filter size={14} />
            <span>Filter</span>
          </button>

          {/* Reset / Refresh Button */}
          <button
            type="button"
            className="monthly-action-btn monthly-reset-btn"
            onClick={handleReset}
            title="Reset Semua Filter"
          >
            <RotateCcw size={14} />
          </button>

          {/* Right Action: Menu `...` matching Gambar 1 & Gambar 2 */}
          <div className="monthly-toolbar-right" ref={moreMenuRef}>
            <button
              type="button"
              className="monthly-more-btn"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              aria-label="Menu Opsi"
              title="Opsi Ekspor & Impor"
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Dropdown Menu matching Gambar 2 */}
            {moreMenuOpen ? (
              <div className="monthly-more-menu">
                <a
                  href={exportUrl}
                  download
                  className="monthly-more-item"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <span>Ekspor Data</span>
                </a>
                <button
                  type="button"
                  className="monthly-more-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setImportNotice(null);
                    setImportFile(null);
                    setImportModalOpen(true);
                  }}
                >
                  <Upload size={15} className="text-sky-600" />
                  <span>Import Excel</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ROW 2: Dropdowns Lokasi, Divisi, Shift matching Gambar 1 */}
        {filterPanelOpen ? <div className="monthly-toolbar-row-2" id="monthly-advanced-filters">
          {/* Lokasi */}
          <div className="monthly-field-group">
            <label className="monthly-field-label">Lokasi</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="monthly-select-dropdown"
            >
              <option value="">Pilih Lokasi</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Divisi */}
          <div className="monthly-field-group">
            <label className="monthly-field-label">Divisi</label>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="monthly-select-dropdown"
            >
              <option value="">Pilih Divisi</option>
              {divisions.map((div) => (
                <option key={div.id} value={div.name}>
                  {div.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shift */}
          <div className="monthly-field-group">
            <label className="monthly-field-label">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="monthly-select-dropdown"
            >
              <option value="">Pilih Shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        </div> : null}

        {/* ROW 3: Segmented Buttons `Masuk` and `Belum Keluar` matching Gambar 1 */}
        <div className="monthly-toolbar-row-3">
          <div className="monthly-segmented-group">
            <button
              type="button"
              className={`monthly-segmented-btn ${activeTab === "masuk" ? "active" : ""}`}
              onClick={() => setActiveTab("masuk")}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`monthly-segmented-btn ${activeTab === "belum_keluar" ? "active" : ""}`}
              onClick={() => setActiveTab("belum_keluar")}
            >
              Belum Keluar
            </button>
          </div>
        </div>

        {/* DATA TABLE matching Gambar 1 */}
        <div className="monthly-content-area">
          {filteredSummaries.length === 0 ? (
            <div className="monthly-empty-state">
              <div className="monthly-empty-illustration">
                <Inbox size={64} strokeWidth={1.2} />
              </div>
              <h3 className="monthly-empty-title">Data Kosong...</h3>
              <p className="monthly-empty-desc">
                Tidak ada data presensi pada periode bulan atau filter yang dipilih.
              </p>
            </div>
          ) : (
            <div className="monthly-table-wrap">
              <table className="monthly-table">
                <thead>
                  <tr>
                    <th className="th-num">#</th>
                    <th className="th-foto">Foto</th>
                    <th className="th-nama">Nama</th>
                    <th className="th-center">Presensi</th>
                    <th className="th-center">Izin/Cuti</th>
                    <th className="th-center">Terlambat</th>
                    <th className="th-center">Jam Kerja</th>
                    <th className="th-center">Jam Aktual</th>
                    <th className="th-center">Jam Istirahat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((row, idx) => (
                    <tr key={row.employeeId}>
                      {/* # Number */}
                      <td className="td-num">{idx + 1}</td>

                      {/* Foto / Avatar matching Gambar 1 */}
                      <td className="td-foto">
                        <div className="monthly-user-avatar-circle">
                          <User size={20} className="text-sky-600" />
                        </div>
                      </td>

                      {/* Nama & NI Badge matching Gambar 1 */}
                      <td className="td-nama">
                        <div className="monthly-emp-name-box">
                          <span className="monthly-ni-badge">
                            NI: {row.employeeCode}
                          </span>
                          <span className="monthly-emp-name-text">
                            {row.employeeName}
                          </span>
                        </div>
                      </td>

                      {/* Presensi */}
                      <td className="td-center">{row.presensiCount}</td>

                      {/* Izin/Cuti */}
                      <td className="td-center">{row.izinCutiCount}</td>

                      {/* Terlambat */}
                      <td className="td-center">
                        {formatMinutesWeb(row.terlambatMinutes)}
                      </td>

                      {/* Jam Kerja */}
                      <td className="td-center">
                        {formatMinutesWeb(row.jamKerjaMinutes)}
                      </td>

                      {/* Jam Aktual */}
                      <td className="td-center">
                        {formatMinutesWeb(row.jamAktualMinutes)}
                      </td>

                      {/* Jam Istirahat */}
                      <td className="td-center">
                        {formatMinutesWeb(row.jamIstirahatMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Table */}
          <footer className="monthly-table-footer">
            <span>
              Menampilkan {filteredSummaries.length} dari {summaries.length} Karyawan
            </span>
          </footer>
        </div>
      </section>

      {/* MODAL IMPORT PRESENSI matching Gambar 4 */}
      {importModalOpen ? (
        <div className="monthly-modal-backdrop" onClick={() => setImportModalOpen(false)}>
          <div className="monthly-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <header className="monthly-modal-header">
              <h2 className="monthly-modal-title">Import Presensi</h2>
              <button
                type="button"
                className="monthly-modal-close"
                onClick={() => setImportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            {/* Modal Form */}
            <form onSubmit={handleImportSubmit} className="monthly-modal-form">
              <div className="monthly-modal-body">
                <p className="monthly-import-info">
                  Anda bisa mengunduh template yang sudah kami sediakan untuk mempermudah pengimporan.
                </p>

                <a
                  href="/api/attendance/admin/monthly/template"
                  download
                  className="monthly-import-template-link"
                >
                  <Download size={14} />
                  <span>Unduh Template</span>
                </a>

                {/* File Upload Box with Dashed Border matching Gambar 4 */}
                <div className="monthly-upload-dashed-box">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="monthly-file-input"
                    required
                  />
                </div>

                {importNotice ? (
                  <div className={`monthly-modal-notice ${importNotice.type}`}>
                    {importNotice.type === "success" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{importNotice.message}</span>
                  </div>
                ) : null}
              </div>

              {/* Big Solid Blue Submit Button matching Gambar 4 */}
              <footer className="monthly-modal-footer">
                <button
                  type="submit"
                  className="monthly-btn-import-submit"
                  disabled={importLoading}
                >
                  {importLoading ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      <span>Mengimpor Data...</span>
                    </>
                  ) : (
                    <span>Import Data</span>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
