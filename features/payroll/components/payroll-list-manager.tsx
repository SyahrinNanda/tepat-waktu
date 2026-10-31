"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Inbox,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { confirmDelete } from "@/components/confirm-dialog";
import { PayrollEditModal } from "@/features/payroll/components/payroll-edit-modal";
import { PayrollModal } from "@/features/payroll/components/payroll-modal";
import type {
  PayrollEmployeeOption,
  PayrollRow,
  PayrollStatus,
  PayrollTermRow,
} from "@/features/payroll/types";

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

const YEAR_OPTIONS = [
  2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
];

const STATUS_OPTIONS: (PayrollStatus | "Pilih Status")[] = [
  "Pilih Status",
  "New",
  "Pending",
  "Done",
  "Finish",
];

function formatNumber(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function formatIndoDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr.slice(0, 10);
  const day = date.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${monthName} ${year}`;
}

type Props = {
  initialRows: PayrollRow[];
  employees: PayrollEmployeeOption[];
  terms: PayrollTermRow[];
  canWrite: boolean;
};

export function PayrollListManager({
  initialRows,
  employees,
  terms,
  canWrite,
}: Props) {
  const [rows, setRows] = useState<PayrollRow[]>(initialRows);

  const now = new Date();
  // Filters (Gambar 1)
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState<number | "">(now.getMonth() + 1);
  const [year, setYear] = useState<number | "">(now.getFullYear());
  const [status, setStatus] = useState<string>("");

  // Menu more options (Gambar 2)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRow | null>(null);

  // State
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  // Close menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchName = row.employeeName.toLowerCase().includes(q);
        const matchCode = row.employeeCode.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      if (month !== "" && row.month !== month) return false;
      if (year !== "" && row.year !== year) return false;
      if (status && status !== "Pilih Status" && row.status !== status) {
        return false;
      }
      return true;
    });
  }, [rows, query, month, year, status]);

  // Pagination calculations
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Reset filters (Tombol merah ATUR ULANG - Gambar 1)
  const handleResetFilters = () => {
    setQuery("");
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setStatus("");
    setPage(1);
  };

  // Reload data from backend
  const refreshData = async () => {
    try {
      const res = await fetch("/api/payroll", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.rows) {
        setRows(data.rows);
      }
    } catch (err) {
      console.error("Refresh payroll error:", err);
    }
  };

  // Tombol UPDATE DAFTAR PAYROLL (Gambar 1)
  const handleUpdateDaftarPayroll = async () => {
    const m = typeof month === "number" ? month : now.getMonth() + 1;
    const y = typeof year === "number" ? year : now.getFullYear();

    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month: m, year: y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          text: data.error || "Gagal update daftar payroll.",
          type: "error",
        });
        return;
      }
      setMessage({
        text: data.message || "Daftar payroll berhasil diperbarui.",
        type: "success",
      });
      await refreshData();
    } catch {
      setMessage({ text: "Server tidak dapat dihubungi.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  // Selesaikan Seluruh Payroll Done (Gambar 2)
  const handleSelesaikanSeluruhPayrollDone = async () => {
    setMenuOpen(false);
    const m = typeof month === "number" ? month : undefined;
    const y = typeof year === "number" ? year : undefined;

    const ok = confirm(
      "Apakah Anda yakin ingin menyelesaikan seluruh daftar payroll pada periode ini menjadi status 'Done'?",
    );
    if (!ok) return;

    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/payroll/mark-done", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month: m, year: y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          text: data.error || "Gagal menyelesaikan seluruh payroll.",
          type: "error",
        });
        return;
      }
      setMessage({
        text: data.message || "Seluruh payroll berhasil diselesaikan (Done).",
        type: "success",
      });
      await refreshData();
    } catch {
      setMessage({ text: "Server tidak dapat dihubungi.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  // Export Payroll Excel (Gambar 2 & 3)
  const handleExportExcel = async () => {
    setExporting(true);
    setMenuOpen(false);
    try {
      const params = new URLSearchParams();
      if (typeof month === "number") params.set("month", String(month));
      if (typeof year === "number") params.set("year", String(year));
      if (status && status !== "Pilih Status") params.set("status", status);

      const res = await fetch(`/api/payroll/export?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal mengunduh file.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-Payroll-${year || "semua"}-${
        month ? String(month).padStart(2, "0") : "semua"
      }.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Gagal mengekspor laporan payroll.");
    } finally {
      setExporting(false);
    }
  };

  // Delete Payroll Row
  const handleDeleteRow = async (row: PayrollRow) => {
    const ok = await confirmDelete(
      `Hapus data payroll untuk ${row.employeeName} periode ${
        MONTH_NAMES[row.month - 1]
      } ${row.year}?`,
      "Konfirmasi Hapus Payroll",
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/payroll/${row.id}`, { method: "DELETE" });
      if (res.ok) {
        setRows((current) => current.filter((r) => r.id !== row.id));
        setMessage({ text: "Payroll berhasil dihapus.", type: "success" });
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menghapus payroll.");
      }
    } catch {
      alert("Server tidak dapat dihubungi.");
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s.toLowerCase()) {
      case "new":
        return "payroll-badge-amber";
      case "pending":
        return "payroll-badge-blue";
      case "done":
        return "payroll-badge-green";
      case "finish":
        return "payroll-badge-purple";
      default:
        return "payroll-badge-amber";
    }
  };

  return (
    <div className="payroll-page-container">
      {/* HEADER SECTION (Gambar 1) */}
      <div className="payroll-header-section">
        <small className="payroll-page-subtitle">Presensi Admin Panel</small>
        <div className="payroll-header-title-row">
          <h1 className="payroll-header-title">LAPORAN DAFTAR PAYROLL</h1>
          <button
            type="button"
            className="payroll-info-btn"
            title="Laporan daftar payroll menyajikan data kompensasi, potongan, gaji pokok, dan berkas slip karyawan."
            aria-label="Informasi"
          >
            <Info size={16} />
          </button>
        </div>
        <div className="payroll-breadcrumb">
          <Link href="/dashboard" className="payroll-breadcrumb-link">
            Beranda
          </Link>
          <span className="payroll-breadcrumb-separator">/</span>
          <span className="payroll-breadcrumb-link">Daftar Payroll</span>
          <span className="payroll-breadcrumb-separator">/</span>
          <span className="payroll-breadcrumb-current">
            Laporan Daftar Payroll
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`payroll-message-alert ${
            message.type === "success" ? "success" : "error"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>
            &times;
          </button>
        </div>
      )}

      {/* CARD CONTENT (Gambar 1) */}
      <div className="payroll-content-card">
        {/* CARD TOP ROW: Judul & Action Buttons (Gambar 1) */}
        <div className="payroll-card-header-row">
          <h2 className="payroll-card-heading">Daftar Payroll Karyawan</h2>

          <div className="payroll-card-actions-right">
            {canWrite && (
              <button
                type="button"
                className="payroll-btn-tambah-solid"
                onClick={() => setModalOpen(true)}
              >
                <Plus size={16} />
                <span>Tambah Payroll</span>
              </button>
            )}

            {canWrite && (
              <button
                type="button"
                className="payroll-btn-update-outline"
                onClick={handleUpdateDaftarPayroll}
                disabled={updating}
              >
                {updating ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <RotateCcw size={15} />
                )}
                <span>UPDATE DAFTAR PAYROLL</span>
              </button>
            )}

            {/* Menu Titik Tiga (Gambar 2) */}
            <div className="payroll-more-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="payroll-btn-more-dots"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Opsi tambahan"
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className="payroll-popover-menu-options">
                  <button
                    type="button"
                    className="payroll-popover-item-option"
                    onClick={handleExportExcel}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                    )}
                    <span>Export Payroll</span>
                  </button>
                  <button
                    type="button"
                    className="payroll-popover-item-option"
                    onClick={handleSelesaikanSeluruhPayrollDone}
                    disabled={updating}
                  >
                    <RotateCcw size={15} className="text-blue-600" />
                    <span>Selesaikan Seluruh Payroll Done</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BARIS FILTER (Gambar 1) */}
        <div className="payroll-filters-inline-grid">
          {/* Filter Nama */}
          <div className="payroll-filter-col">
            <label className="payroll-filter-label-clean">Filter Nama:</label>
            <input
              type="text"
              className="payroll-filter-input-clean"
              placeholder="Nama Karyawan..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Filter Bulan */}
          <div className="payroll-filter-col">
            <label className="payroll-filter-label-clean">Filter Bulan:</label>
            <select
              className="payroll-filter-select-clean"
              value={month}
              onChange={(e) => {
                const val = e.target.value;
                setMonth(val === "" ? "" : Number(val));
                setPage(1);
              }}
            >
              <option value="">Semua Bulan</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tahun */}
          <div className="payroll-filter-col">
            <label className="payroll-filter-label-clean">Filter Tahun:</label>
            <select
              className="payroll-filter-select-clean"
              value={year}
              onChange={(e) => {
                const val = e.target.value;
                setYear(val === "" ? "" : Number(val));
                setPage(1);
              }}
            >
              <option value="">Semua Tahun</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="payroll-filter-col">
            <label className="payroll-filter-label-clean">Filter Status :</label>
            <select
              className="payroll-filter-select-clean"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s === "Pilih Status" ? "" : s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Atur Ulang Filter (Tombol Merah) */}
          <div className="payroll-filter-col payroll-filter-col-reset">
            <label className="payroll-filter-label-clean">
              Atur Ulang Filter:
            </label>
            <button
              type="button"
              className="payroll-btn-atur-ulang-red"
              onClick={handleResetFilters}
            >
              <RotateCcw size={15} />
              <span>ATUR ULANG</span>
            </button>
          </div>
        </div>

        {/* TABLE SECTION (Gambar 1) */}
        <div className="payroll-table-wrapper">
          <table className="payroll-data-table-v2">
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>#</th>
                <th>Nama</th>
                <th>Periode</th>
                <th>Tanggal</th>
                <th>Waktu Kerja</th>
                <th style={{ textAlign: "right" }}>Gaji</th>
                <th style={{ textAlign: "center" }}>Kompensasi</th>
                <th style={{ textAlign: "center" }}>Potongan</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "center" }}>Status</th>
                {canWrite && (
                  <th style={{ width: "90px", textAlign: "center" }}>Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => {
                const periode = `${MONTH_NAMES[row.month - 1]} ${row.year}`;
                const tanggal = formatIndoDate(row.createdAt);
                const waktuKerja = `${row.quantity} ${row.salaryType.toLowerCase()}`;
                const baseGaji = formatNumber(row.rate * row.quantity);
                const kompensasi =
                  row.compensationAmount > 0
                    ? formatNumber(row.compensationAmount)
                    : "-";
                const potongan =
                  row.deductionAmount > 0
                    ? formatNumber(row.deductionAmount)
                    : "-";
                const total = formatNumber(row.totalAmount);

                return (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>
                      {startRow + index}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="payroll-emp-name-btn"
                        onClick={() => setEditingPayroll(row)}
                        title="Klik untuk melihat / mengedit detail payroll"
                      >
                        {row.employeeName}
                      </button>
                    </td>
                    <td>{periode}</td>
                    <td>{tanggal}</td>
                    <td>{waktuKerja}</td>
                    <td style={{ textAlign: "right" }}>{baseGaji}</td>
                    <td style={{ textAlign: "center" }}>{kompensasi}</td>
                    <td style={{ textAlign: "center" }}>{potongan}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {total}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`payroll-badge-tag ${getStatusBadgeClass(
                          row.status,
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    {canWrite && (
                      <td>
                        <div className="payroll-table-action-btns">
                          <button
                            type="button"
                            className="payroll-btn-action-pencil"
                            title="Edit Payroll"
                            onClick={() => setEditingPayroll(row)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="payroll-btn-action-trash"
                            title="Hapus Payroll"
                            onClick={() => handleDeleteRow(row)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State (Gambar 2) */}
          {!filtered.length && (
            <div className="payroll-empty-container">
              <div className="payroll-empty-illustration">
                <div className="payroll-empty-cloud" />
                <div className="payroll-empty-box">
                  <Inbox size={42} />
                </div>
              </div>
              <h3 className="payroll-empty-title">Data Kosong</h3>
            </div>
          )}
        </div>

        {/* FOOTER PAGINATION (Gambar 1) */}
        <div className="payroll-footer-row-simple">
          <span>
            menampilkan {totalCount === 0 ? 0 : startRow} dari {totalCount}{" "}
            data, Tampilkan
          </span>
          <div className="payroll-page-size-btns">
            <button
              type="button"
              className={`payroll-page-size-chip ${
                pageSize === 25 ? "active" : ""
              }`}
              onClick={() => {
                setPageSize(25);
                setPage(1);
              }}
            >
              25
            </button>
            <button
              type="button"
              className={`payroll-page-size-chip ${
                pageSize === 50 ? "active" : ""
              }`}
              onClick={() => {
                setPageSize(50);
                setPage(1);
              }}
            >
              50
            </button>
            <button
              type="button"
              className={`payroll-page-size-chip ${
                pageSize === 100 ? "active" : ""
              }`}
              onClick={() => {
                setPageSize(100);
                setPage(1);
              }}
            >
              100
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH PAYROLL */}
      <PayrollModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        employees={employees}
        onSuccess={() => {
          refreshData();
          setMessage({
            text: "Data payroll berhasil ditambahkan.",
            type: "success",
          });
        }}
        defaultMonth={typeof month === "number" ? month : undefined}
        defaultYear={typeof year === "number" ? year : undefined}
      />

      {/* MODAL EDIT PAYROLL (Gambar 4, 5, 6, 7) */}
      {editingPayroll && (
        <PayrollEditModal
          key={editingPayroll.id}
          isOpen={true}
          onClose={() => setEditingPayroll(null)}
          payroll={editingPayroll}
          terms={terms}
          onUpdated={refreshData}
        />
      )}
    </div>
  );
}
