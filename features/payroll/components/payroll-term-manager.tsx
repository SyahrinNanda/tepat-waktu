"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Inbox,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { confirmDelete } from "@/components/confirm-dialog";
import type { PayrollTermRow, PayrollTermType } from "@/features/payroll/types";

const typeLabels: Record<PayrollTermType, string> = {
  compensation: "Kompensasi",
  deduction: "Potongan",
};

type Props = {
  initialRows: PayrollTermRow[];
  canManage: boolean;
};

export function PayrollTermManager({ initialRows, canManage }: Props) {
  const [rows, setRows] = useState<PayrollTermRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("");
  const [editing, setEditing] = useState<PayrollTermRow | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  // Filter rows
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchQuery =
        !query.trim() ||
        row.name.toLowerCase().includes(query.toLowerCase().trim());
      const matchType = !type || row.type === type;
      return matchQuery && matchType;
    });
  }, [rows, query, type]);

  // Pagination calculations
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalCount);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleReset = () => {
    setQuery("");
    setType("");
    setPage(1);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const termType = String(form.get("type") || "").trim();

    if (!name) {
      setError("Nama istilah wajib diisi.");
      setBusy(false);
      return;
    }
    if (!termType || (termType !== "compensation" && termType !== "deduction")) {
      setError("Pilih tipe istilah.");
      setBusy(false);
      return;
    }

    try {
      const body = {
        name,
        type: termType,
        active: editing?.active ?? true,
      };

      const res = await fetch(
        editing ? `/api/master/payroll-terms/${editing.id}` : "/api/master/payroll-terms",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Gagal menyimpan istilah.");
        return;
      }

      if (editing) {
        setRows((current) =>
          current.map((r) => (r.id === payload.row.id ? payload.row : r)),
        );
      } else {
        setRows((current) =>
          [...current, payload.row].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      setEditing(undefined);
    } catch {
      setError("Server tidak dapat dihubungi.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: PayrollTermRow) => {
    const ok = await confirmDelete(
      `Hapus istilah "${row.name}"? Data yang sudah dihapus tidak dapat dikembalikan.`,
      "Konfirmasi Hapus Istilah",
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/master/payroll-terms/${row.id}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (res.ok) {
        setRows((current) => current.filter((item) => item.id !== row.id));
      } else {
        alert(payload.error || "Gagal menghapus istilah.");
      }
    } catch {
      alert("Server tidak dapat dihubungi.");
    }
  };

  return (
    <div className="payroll-page-container">
      {/* HEADER SECTION (Gambar 1) */}
      <div className="payroll-header-section">
        <div className="payroll-header-title-row">
          <h1 className="payroll-header-title">DAFTAR ISTILAH GAJI</h1>
          <button
            type="button"
            className="payroll-info-btn"
            title="Daftar istilah gaji digunakan untuk menentukan komponen kompensasi dan potongan payroll."
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
          <span className="payroll-breadcrumb-link">Istilah</span>
          <span className="payroll-breadcrumb-separator">/</span>
          <span className="payroll-breadcrumb-current">Daftar Istilah Gaji</span>
        </div>
      </div>

      {/* CARD CONTENT */}
      <div className="payroll-content-card">
        {/* TOOLBAR (Gambar 1 & 2) */}
        <div className="payroll-term-toolbar-row">
          {/* Filter Tipe Dropdown */}
          <div className="payroll-filter-item">
            <label className="payroll-filter-label" htmlFor="filter-type">
              Filter Tipe:
            </label>
            <select
              id="filter-type"
              className="payroll-select-input"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Pilih Tipe</option>
              <option value="compensation">Kompensasi</option>
              <option value="deduction">Potongan</option>
            </select>
          </div>

          {/* Search box */}
          <div className="payroll-search-box">
            <Search size={16} className="payroll-search-icon" />
            <input
              type="text"
              className="payroll-search-input"
              placeholder="Cari nama istilah..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Reset button */}
          <button
            type="button"
            className="payroll-btn-reset-icon"
            title="Reset filter"
            onClick={handleReset}
          >
            <RotateCcw size={17} />
          </button>

          <div className="payroll-toolbar-spacer" />

          {/* Tambah Button */}
          {canManage && (
            <button
              type="button"
              className="payroll-btn-primary"
              onClick={() => {
                setError("");
                setEditing(null);
              }}
            >
              <Plus size={16} />
              <span>Tambah</span>
            </button>
          )}
        </div>

        {error && editing === undefined && (
          <div className="announcement-inline-error">{error}</div>
        )}

        {/* TABLE SECTION */}
        <div className="payroll-table-wrapper">
          <table className="payroll-data-table">
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>#</th>
                <th>Nama</th>
                <th style={{ width: "180px" }}>Type</th>
                {canManage && (
                  <th style={{ width: "140px", textAlign: "center" }}>Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={row.id}>
                  <td style={{ textAlign: "center" }}>{startRow + index}</td>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    <span
                      className={`payroll-badge ${
                        row.type === "compensation"
                          ? "payroll-badge-green"
                          : "payroll-badge-red"
                      }`}
                    >
                      {typeLabels[row.type]}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="payroll-actions-cell">
                        <button
                          type="button"
                          className="payroll-action-btn edit"
                          title="Edit istilah"
                          onClick={() => {
                            setError("");
                            setEditing(row);
                          }}
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-action-btn delete"
                          title="Hapus istilah"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 size={14} />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State (Gambar 1) */}
          {!filtered.length && (
            <div className="payroll-empty-container">
              <div className="payroll-empty-illustration">
                <div className="payroll-empty-cloud" />
                <div className="payroll-empty-box">
                  <Inbox size={42} />
                </div>
              </div>
              <h3 className="payroll-empty-title">Data Kosong</h3>
              <p className="payroll-empty-desc">
                Belum ada data untuk ditampilkan
              </p>
            </div>
          )}
        </div>

        {/* FOOTER PAGINATION */}
        <div className="payroll-footer-row">
          <div className="payroll-page-size-wrap">
            <span>Tampilkan</span>
            <button
              type="button"
              className={`payroll-page-size-btn ${pageSize === 25 ? "active" : ""}`}
              onClick={() => {
                setPageSize(25);
                setPage(1);
              }}
            >
              25
            </button>
            <button
              type="button"
              className={`payroll-page-size-btn ${pageSize === 50 ? "active" : ""}`}
              onClick={() => {
                setPageSize(50);
                setPage(1);
              }}
            >
              50
            </button>
            <button
              type="button"
              className={`payroll-page-size-btn ${pageSize === 100 ? "active" : ""}`}
              onClick={() => {
                setPageSize(100);
                setPage(1);
              }}
            >
              100
            </button>
          </div>

          <div className="payroll-pagination-wrap">
            <span className="payroll-pagination-info">
              Menampilkan {startRow} - {endRow} dari {totalCount} data
            </span>
            <div className="payroll-pagination-btns">
              <button
                type="button"
                className="payroll-nav-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              <button type="button" className="payroll-nav-btn active">
                {currentPage}
              </button>
              <button
                type="button"
                className="payroll-nav-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DRAWER SLIDE-OVER (Gambar 3) */}
      {editing !== undefined && (
        <div
          className="master-drawer-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(undefined);
          }}
        >
          <aside className="master-drawer">
            <header>
              <button
                type="button"
                onClick={() => !busy && setEditing(undefined)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
              <h2>{editing ? "Edit Istilah" : "Tambah Istilah"}</h2>
            </header>

            <form onSubmit={handleSave} className="drawer-form">
              <label>
                Nama Istilah
                <input
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Masukan Nama Istilah"
                  required
                  autoFocus
                />
              </label>

              <label>
                Type Istilah
                <select
                  name="type"
                  defaultValue={editing?.type ?? ""}
                  required
                >
                  <option value="" disabled>
                    Pilih Type Istillah
                  </option>
                  <option value="compensation">Kompensasi</option>
                  <option value="deduction">Potongan</option>
                </select>
              </label>

              {error && <div className="announcement-inline-error">{error}</div>}

              <footer>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => setEditing(undefined)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </footer>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
