/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Filter,
  Inbox,
  LoaderCircle,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  position?: string | null;
};

export type ShiftOption = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type LocationOption = {
  id: string;
  name: string;
};

export type DivisionOption = {
  id: string;
  name: string;
};

export type DailyAttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  department: string | null;
  shiftId: string | null;
  shiftName: string | null;
  shiftHours: string | null;
  checkIn: string | null;
  checkInLocationId: string | null;
  checkInLocationName: string | null;
  checkInPhotoAssetId: string | null;
  checkOut: string | null;
  checkOutLocationId: string | null;
  checkOutLocationName: string | null;
  checkOutPhotoAssetId: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status: "present" | "late" | "leave" | "absent";
  note: string | null;
};

type Props = {
  initialDate: string;
  employees: EmployeeOption[];
  shifts: ShiftOption[];
  locations: LocationOption[];
  divisions: DivisionOption[];
  records: DailyAttendanceRecord[];
};

export function DailyAttendanceManager({
  initialDate,
  employees,
  shifts,
  locations,
  divisions,
  records,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [date, setDate] = useState(initialDate);
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activePill, setActivePill] = useState<string>("all");

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyAttendanceRecord | null>(null);

  // Lightbox Preview State
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Toast / Notice
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync date with URL params
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handlePrevDay = () => {
    const current = new Date(`${date}T00:00:00`);
    current.setDate(current.getDate() - 1);
    const prev = current.toISOString().slice(0, 10);
    handleDateChange(prev);
  };

  const handleNextDay = () => {
    const current = new Date(`${date}T00:00:00`);
    current.setDate(current.getDate() + 1);
    const next = current.toISOString().slice(0, 10);
    handleDateChange(next);
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterLocation("");
    setFilterDivision("");
    setFilterShift("");
    setFilterPanelOpen(false);
    setActivePill("all");
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) {
      handleDateChange(today);
    }
  };

  // Merge active employees with daily records to represent both registered & unregistered attendance
  const combinedRows = useMemo(() => {
    const recordMap = new Map<string, DailyAttendanceRecord>();
    for (const rec of records) {
      recordMap.set(rec.employeeId, rec);
    }

    return employees.map((emp) => {
      const rec = recordMap.get(emp.id);
      if (rec) return rec;

      return {
        id: "",
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department,
        shiftId: null,
        shiftName: null,
        shiftHours: null,
        checkIn: null,
        checkInLocationId: null,
        checkInLocationName: null,
        checkInPhotoAssetId: null,
        checkOut: null,
        checkOutLocationId: null,
        checkOutLocationName: null,
        checkOutPhotoAssetId: null,
        breakStart: null,
        breakEnd: null,
        status: "absent" as const,
        note: null,
      };
    });
  }, [employees, records]);

  // Counts for segmented pills
  const pillCounts = useMemo(() => {
    let masuk = 0;
    let belumMasuk = 0;
    let belumKeluar = 0;
    let terlambat = 0;
    let izin = 0;
    let alpa = 0;

    for (const row of combinedRows) {
      if (row.checkIn) masuk++;
      else belumMasuk++;

      if (row.checkIn && !row.checkOut) belumKeluar++;
      if (row.status === "late") terlambat++;
      if (row.status === "leave") izin++;
      if (row.status === "absent" && row.id) alpa++;
    }

    return { masuk, belumMasuk, belumKeluar, terlambat, izin, alpa };
  }, [combinedRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return combinedRows.filter((row) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchName = row.employeeName.toLowerCase().includes(q);
        const matchCode = (row.employeeCode || "").toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      // Filter Location
      if (filterLocation) {
        const matchCheckIn = row.checkInLocationId === filterLocation || row.checkInLocationName === filterLocation;
        const matchCheckOut = row.checkOutLocationId === filterLocation || row.checkOutLocationName === filterLocation;
        if (!matchCheckIn && !matchCheckOut) return false;
      }

      // Filter Division
      if (filterDivision) {
        if (row.department !== filterDivision) return false;
      }

      // Filter Jadwal Kerja
      if (filterShift) {
        if (row.shiftId !== filterShift) return false;
      }

      // Active Pill filter
      if (activePill === "masuk") {
        if (!row.checkIn) return false;
      } else if (activePill === "belum_masuk") {
        if (row.checkIn) return false;
      } else if (activePill === "belum_keluar") {
        if (!row.checkIn || row.checkOut) return false;
      } else if (activePill === "terlambat") {
        if (row.status !== "late") return false;
      } else if (activePill === "izin") {
        if (row.status !== "leave") return false;
      } else if (activePill === "alpa") {
        if (row.status !== "absent") return false;
      }

      return true;
    });
  }, [combinedRows, search, filterLocation, filterDivision, filterShift, activePill]);

  // Delete Action
  const handleDeleteAttendance = async (id: string) => {
    if (!id) return;
    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/attendance/admin?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus kehadiran.");

      setNotice({ type: "success", message: "Kehadiran berhasil dihapus." });
      setDeletingId(null);
      router.refresh();
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setDeletingLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (row: DailyAttendanceRecord) => {
    setEditingRecord(row);
    setModalOpen(true);
  };

  return (
    <div className="daily-attendance-container">
      {/* Header Eyebrow & Title matching Gambar 1 */}
      <header className="daily-attendance-header">
        <div className="daily-attendance-eyebrow">PRESENSI ADMIN PANEL</div>
        <div className="daily-attendance-title-row">
          <h1 className="daily-attendance-title">Kehadiran</h1>
          <nav className="daily-attendance-breadcrumb">
            <Link href="/dashboard">Kehadiran</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Kehadiran</span>
          </nav>
        </div>
      </header>

      {/* Notice Banner */}
      {notice ? (
        <div className={`daily-attendance-alert ${notice.type}`}>
          {notice.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Main Card with Toolbar & Content matching Gambar 1 */}
      <section className="daily-attendance-card">
        {/* Row 1: Date Navigation, Search, Filter & Actions */}
        <div className="daily-toolbar-row-1">
          {/* Left: Date Navigation */}
          <div className="daily-date-nav">
            <button
              type="button"
              className="daily-nav-btn"
              onClick={handlePrevDay}
              title="Hari Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="daily-date-input-wrap">
              <Calendar size={14} className="daily-date-icon" />
              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="daily-date-input"
              />
            </div>
            <button
              type="button"
              className="daily-nav-btn"
              onClick={handleNextDay}
              title="Hari Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Search Box */}
          <div className="daily-search-box">
            <Search size={15} className="daily-search-icon" />
            <input
              type="text"
              placeholder="Cari Nama / ID Pegawai..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="daily-search-input"
            />
            {search ? (
              <button
                type="button"
                className="daily-search-clear"
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Filter & Reset Buttons */}
          <button
            type="button"
            className={`daily-action-btn daily-filter-btn ${filterPanelOpen ? "active" : ""}`}
            onClick={() => setFilterPanelOpen((open) => !open)}
            title={filterPanelOpen ? "Tutup Filter" : "Buka Filter"}
            aria-expanded={filterPanelOpen}
            aria-controls="daily-advanced-filters"
          >
            <Filter size={14} />
            <span>Filter</span>
          </button>

          <button
            type="button"
            className="daily-action-btn daily-reset-btn"
            onClick={handleResetFilters}
            title="Reset Semua Filter"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Right Action: Tambah Kehadiran & More Menu */}
          <div className="daily-toolbar-right">
            <button
              type="button"
              className="daily-btn-primary"
              onClick={openAddModal}
            >
              <Plus size={16} />
              <span>Tambah Kehadiran</span>
            </button>

            {/* Dropdown Menu `...` */}
            <div className="daily-more-dropdown-wrap" ref={moreMenuRef}>
              <button
                type="button"
                className="daily-more-btn"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                aria-label="Menu Opsi"
              >
                <MoreHorizontal size={17} />
              </button>

              {moreMenuOpen ? (
                <div className="daily-more-menu">
                  <a
                    href={`/api/attendance/admin/export?date=${date}`}
                    download
                    className="daily-more-item"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Export Excel</span>
                  </a>
                  <button
                    type="button"
                    className="daily-more-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      openAddModal();
                    }}
                  >
                    <Upload size={15} className="text-sky-600" />
                    <span>Catat Kehadiran Baru</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Row 2: Dropdowns for Location, Division, and Jadwal Kerja matching Gambar 1 */}
        {filterPanelOpen ? <div className="daily-toolbar-row-2" id="daily-advanced-filters">
          <div className="daily-select-wrap">
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="daily-select"
            >
              <option value="">Semua Lokasi Kerja</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="daily-select-wrap">
            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="daily-select"
            >
              <option value="">Semua Divisi</option>
              {divisions.map((div) => (
                <option key={div.id} value={div.name}>
                  {div.name}
                </option>
              ))}
            </select>
          </div>

          <div className="daily-select-wrap">
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="daily-select"
            >
              <option value="">Semua Jadwal Kerja</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        </div> : null}

        {/* Row 3: Status Pills matching Gambar 1 */}
        <div className="daily-toolbar-row-3">
          <button
            type="button"
            className={`daily-pill ${activePill === "all" ? "active" : ""}`}
            onClick={() => setActivePill("all")}
          >
            Semua ({combinedRows.length})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "masuk" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "masuk" ? "all" : "masuk")}
          >
            Masuk ({pillCounts.masuk})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "belum_masuk" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "belum_masuk" ? "all" : "belum_masuk")}
          >
            Belum Masuk ({pillCounts.belumMasuk})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "belum_keluar" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "belum_keluar" ? "all" : "belum_keluar")}
          >
            Belum Keluar ({pillCounts.belumKeluar})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "terlambat" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "terlambat" ? "all" : "terlambat")}
          >
            Terlambat ({pillCounts.terlambat})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "izin" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "izin" ? "all" : "izin")}
          >
            Izin ({pillCounts.izin})
          </button>
          <button
            type="button"
            className={`daily-pill ${activePill === "alpa" ? "active" : ""}`}
            onClick={() => setActivePill(activePill === "alpa" ? "all" : "alpa")}
          >
            Alpa ({pillCounts.alpa})
          </button>
        </div>

        {/* Content Area: Empty State matching Gambar 1 OR Data Table */}
        <div className="daily-content-area">
          {filteredRows.length === 0 ? (
            <div className="daily-empty-state">
              <div className="daily-empty-illustration">
                <Inbox size={68} strokeWidth={1.2} />
              </div>
              <h3 className="daily-empty-title">Data Kosong...</h3>
              <p className="daily-empty-desc">
                Belum ada data kehadiran pada tanggal ini atau filter yang dipilih.
              </p>
            </div>
          ) : (
            <div className="daily-table-wrap">
              <table className="daily-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Pegawai</th>
                    <th>Jadwal Kerja</th>
                    <th>Masuk</th>
                    <th>Keluar</th>
                    <th>Istirahat</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const initials = row.employeeName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={row.employeeId}>
                        <td className="daily-col-date">
                          <span>{formatDisplayDate(date)}</span>
                        </td>
                        <td className="daily-col-employee">
                          <div className="daily-emp-cell">
                            <span className="daily-avatar">{initials}</span>
                            <div>
                              <strong className="daily-emp-name">{row.employeeName}</strong>
                              <small className="daily-emp-meta">
                                {row.employeeCode || "—"} · {row.department || "Umum"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="daily-col-shift">
                          {row.shiftName ? (
                            <div>
                              <strong className="daily-shift-name">{row.shiftName}</strong>
                              {row.shiftHours ? (
                                <small className="daily-shift-hours">{row.shiftHours}</small>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="daily-col-checkin">
                          {row.checkIn ? (
                            <div className="daily-time-cell">
                              <span className="daily-time-text">{row.checkIn.slice(0, 5)}</span>
                              {row.checkInLocationName ? (
                                <small className="daily-location-text">
                                  <MapPin size={11} /> {row.checkInLocationName}
                                </small>
                              ) : null}
                              {row.checkInPhotoAssetId ? (
                                <button
                                  type="button"
                                  className="daily-photo-thumb-btn"
                                  onClick={() => setLightboxUrl(`/api/files/${row.checkInPhotoAssetId}`)}
                                  title="Lihat Foto Masuk"
                                >
                                  <Camera size={12} />
                                  <span>Foto Masuk</span>
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="badge-missing">Belum Masuk</span>
                          )}
                        </td>
                        <td className="daily-col-checkout">
                          {row.checkOut ? (
                            <div className="daily-time-cell">
                              <span className="daily-time-text">{row.checkOut.slice(0, 5)}</span>
                              {row.checkOutLocationName ? (
                                <small className="daily-location-text">
                                  <MapPin size={11} /> {row.checkOutLocationName}
                                </small>
                              ) : null}
                              {row.checkOutPhotoAssetId ? (
                                <button
                                  type="button"
                                  className="daily-photo-thumb-btn"
                                  onClick={() => setLightboxUrl(`/api/files/${row.checkOutPhotoAssetId}`)}
                                  title="Lihat Foto Keluar"
                                >
                                  <Camera size={12} />
                                  <span>Foto Keluar</span>
                                </button>
                              ) : null}
                            </div>
                          ) : row.checkIn ? (
                            <span className="badge-missing">Belum Keluar</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="daily-col-break">
                          {row.breakStart || row.breakEnd ? (
                            <span className="daily-break-text">
                              {row.breakStart ? row.breakStart.slice(0, 5) : "—"} -{" "}
                              {row.breakEnd ? row.breakEnd.slice(0, 5) : "—"}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="daily-col-status">
                          <StatusBadgeView status={row.status} hasRecord={Boolean(row.id)} />
                        </td>
                        <td className="daily-col-actions text-right">
                          <div className="daily-actions-group">
                            {row.id ? (
                              <Link
                                href={`/dashboard/presensi/harian/${row.id}`}
                                className="daily-action-icon-btn"
                                title="Lihat Detail Audit"
                              >
                                <Eye size={15} />
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="daily-action-icon-btn"
                              title="Edit Kehadiran"
                              onClick={() => openEditModal(row)}
                            >
                              <Pencil size={14} />
                            </button>
                            {row.id ? (
                              <button
                                type="button"
                                className="daily-action-icon-btn danger"
                                title="Hapus Kehadiran"
                                onClick={() => setDeletingId(row.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer matching Gambar 1 */}
          <footer className="daily-table-footer">
            <span>
              Menampilkan {filteredRows.length} dari {combinedRows.length} Data
            </span>
          </footer>
        </div>
      </section>

      {/* Modal Tambah / Edit Kehadiran matching Gambar 2, 3, 4, 5 */}
      {modalOpen ? (
        <AttendanceModal
          defaultDate={date}
          editingRecord={editingRecord}
          employees={employees}
          shifts={shifts}
          locations={locations}
          onClose={() => setModalOpen(false)}
          onSuccess={(msg) => {
            setModalOpen(false);
            setNotice({ type: "success", message: msg });
            router.refresh();
          }}
        />
      ) : null}

      {/* Delete Confirmation Modal */}
      {deletingId ? (
        <div className="daily-modal-backdrop">
          <div className="daily-confirm-dialog">
            <h3 className="confirm-title">Hapus Data Kehadiran</h3>
            <p className="confirm-desc">
              Apakah Anda yakin ingin menghapus catatan kehadiran pegawai ini? Data riwayat audit
              check-in dan check-out akan ikut dihapus.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingId(null)}
                disabled={deletingLoading}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDeleteAttendance(deletingId)}
                disabled={deletingLoading}
              >
                {deletingLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>Hapus Kehadiran</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Photo Lightbox */}
      {lightboxUrl ? (
        <div className="daily-modal-backdrop" onClick={() => setLightboxUrl(null)}>
          <div className="daily-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <header className="daily-lightbox-header">
              <span>Bukti Foto Kehadiran</span>
              <button type="button" onClick={() => setLightboxUrl(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="daily-lightbox-body">
              <img src={lightboxUrl} alt="Bukti Foto Kehadiran" className="daily-lightbox-img" />
            </div>
            <footer className="daily-lightbox-footer">
              <a href={lightboxUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                Buka Ukuran Penuh
              </a>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =========================================================================
// Modal Component matching Gambar 2, 3, 4, 5
// =========================================================================
type ModalProps = {
  defaultDate: string;
  editingRecord: DailyAttendanceRecord | null;
  employees: EmployeeOption[];
  shifts: ShiftOption[];
  locations: LocationOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

function AttendanceModal({
  defaultDate,
  editingRecord,
  employees,
  shifts,
  locations,
  onClose,
  onSuccess,
}: ModalProps) {
  const [modalDate, setModalDate] = useState(editingRecord ? defaultDate : defaultDate);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(() => {
    if (editingRecord) {
      return employees.find((e) => e.id === editingRecord.employeeId) || {
        id: editingRecord.employeeId,
        name: editingRecord.employeeName,
        employeeCode: editingRecord.employeeCode,
        department: editingRecord.department,
      };
    }
    return null;
  });

  // Autocomplete state
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Selected shift
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => {
    return editingRecord?.shiftId || shifts[0]?.id || "";
  });

  // Check In Section
  const [checkInTime, setCheckInTime] = useState<string>(() => {
    return editingRecord?.checkIn ? editingRecord.checkIn.slice(0, 5) : "08:00";
  });
  const [checkInLocationId, setCheckInLocationId] = useState<string>(() => {
    return editingRecord?.checkInLocationId || locations[0]?.id || "";
  });
  const [checkInStatus, setCheckInStatus] = useState<string>(() => {
    return editingRecord?.status || "present";
  });
  const [checkInNote, setCheckInNote] = useState<string>(() => {
    return editingRecord?.note || "Kehadiran masuk karyawan";
  });

  // Check Out Section
  const [checkOutTime, setCheckOutTime] = useState<string>(() => {
    return editingRecord?.checkOut ? editingRecord.checkOut.slice(0, 5) : "17:00";
  });
  const [checkOutLocationId, setCheckOutLocationId] = useState<string>(() => {
    return editingRecord?.checkOutLocationId || locations[0]?.id || "";
  });
  const [checkOutStatus, setCheckOutStatus] = useState<string>("present");
  const [checkOutNote, setCheckOutNote] = useState<string>("Kehadiran keluar karyawan");

  // Break Section
  const [breakStartTime, setBreakStartTime] = useState<string>(() => {
    return editingRecord?.breakStart ? editingRecord.breakStart.slice(0, 5) : "12:00";
  });
  const [breakEndTime, setBreakEndTime] = useState<string>(() => {
    return editingRecord?.breakEnd ? editingRecord.breakEnd.slice(0, 5) : "13:00";
  });
  const [breakNote, setBreakNote] = useState<string>("");

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Autocomplete filtering
  const matchingEmployees = useMemo(() => {
    if (!employeeQuery.trim()) return employees;
    const q = employeeQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.employeeCode || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
    );
  }, [employees, employeeQuery]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelectEmployee = (emp: EmployeeOption) => {
    setSelectedEmployee(emp);
    setEmployeeQuery("");
    setDropdownOpen(false);
  };

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    setEmployeeQuery("");
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedEmployee) {
      setErrorMsg("Silakan pilih pegawai terlebih dahulu.");
      return;
    }

    if (!modalDate) {
      setErrorMsg("Tanggal kehadiran wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("employeeId", selectedEmployee.id);
      formData.set("date", modalDate);
      if (selectedShiftId) formData.set("shiftId", selectedShiftId);

      // Check-in data
      if (checkInTime) formData.set("checkInTime", checkInTime);
      if (checkInLocationId) formData.set("checkInLocationId", checkInLocationId);

      // Check-out data
      if (checkOutTime) formData.set("checkOutTime", checkOutTime);
      if (checkOutLocationId) formData.set("checkOutLocationId", checkOutLocationId);

      // Break data
      if (breakStartTime) formData.set("breakStartTime", breakStartTime);
      if (breakEndTime) formData.set("breakEndTime", breakEndTime);

      // Combined status & notes
      formData.set("status", checkInStatus);
      const combinedNotes = [checkInNote, checkOutNote, breakNote].filter(Boolean).join(" | ");
      formData.set("note", combinedNotes || "Kehadiran manual dicatat admin");

      const response = await fetch("/api/attendance/admin", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Gagal menyimpan kehadiran.");
      }

      onSuccess(result.message || "Kehadiran berhasil disimpan.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan kehadiran.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="daily-modal-backdrop">
        <div className="daily-modal-card">
          {/* Modal Header matching Gambar 2 */}
          <header className="daily-modal-header">
            <div>
              <h2 className="daily-modal-title">
                {editingRecord ? "Edit Kehadiran" : "Tambah Kehadiran"}
              </h2>
              <p className="daily-modal-subtitle">
                Catat kehadiran pegawai secara manual untuk tanggal terpilih
              </p>
            </div>
            <button type="button" className="daily-modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </header>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="daily-modal-form">
            <div className="daily-modal-body">
              {/* Row 1: Tanggal, Pegawai (Autocomplete Gambar 3), Jadwal Kerja */}
              <div className="daily-modal-top-grid">
                {/* 1. Tanggal Kehadiran */}
                <div className="daily-modal-field">
                  <label className="daily-field-label">
                    Tanggal Kehadiran <span className="text-red-500">*</span>
                  </label>
                  <div className="daily-input-with-icon">
                    <Calendar size={15} />
                    <input
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="daily-modal-input"
                      required
                    />
                  </div>
                </div>

                {/* 2. Pegawai Autocomplete matching Gambar 3 */}
                <div className="daily-modal-field" ref={dropdownRef}>
                  <label className="daily-field-label">
                    Pegawai <span className="text-red-500">*</span>
                  </label>
                  {selectedEmployee ? (
                    <div className="daily-selected-employee-pill">
                      <div className="daily-selected-emp-info">
                        <span className="daily-avatar-mini">
                          {selectedEmployee.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{selectedEmployee.name}</strong>
                          <small>
                            {selectedEmployee.employeeCode || "—"} · {selectedEmployee.department || "Umum"}
                          </small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="daily-clear-emp-btn"
                        onClick={handleClearEmployee}
                        title="Ganti Pegawai"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="daily-autocomplete-container">
                      <div className="daily-input-with-icon">
                        <Search size={15} />
                        <input
                          type="text"
                          placeholder="Cari nama atau ID pegawai..."
                          value={employeeQuery}
                          onChange={(e) => {
                            setEmployeeQuery(e.target.value);
                            setDropdownOpen(true);
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          className="daily-modal-input"
                        />
                      </div>
                      {dropdownOpen ? (
                        <div className="daily-autocomplete-dropdown">
                          {matchingEmployees.length === 0 ? (
                            <div className="daily-dropdown-empty">Pegawai tidak ditemukan.</div>
                          ) : (
                            matchingEmployees.map((emp) => (
                              <button
                                key={emp.id}
                                type="button"
                                className="daily-dropdown-item"
                                onClick={() => handleSelectEmployee(emp)}
                              >
                                <span className="daily-avatar-mini">
                                  {emp.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="daily-dropdown-info">
                                  <strong>{emp.name}</strong>
                                  <small>
                                    {emp.employeeCode || "—"} · {emp.department || "Umum"}
                                  </small>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* 3. Jadwal Kerja */}
                <div className="daily-modal-field">
                  <label className="daily-field-label">Jadwal Kerja</label>
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="daily-modal-select"
                  >
                    <option value="">Pilih Jadwal Kerja</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: 3 Cards for Masuk, Keluar, Istirahat matching Gambar 2 */}
              <div className="daily-modal-cards-grid">
                {/* CARD 1: MASUK */}
                <div className="daily-subcard card-masuk">
                  <header className="daily-subcard-header header-masuk">
                    <span className="dot dot-green" />
                    <h3>Masuk</h3>
                  </header>

                  <div className="daily-subcard-body">
                    <div className="daily-subcard-field">
                      <label>Jam Masuk</label>
                      <input
                        type="time"
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        className="daily-modal-input"
                      />
                    </div>

                    <div className="daily-subcard-field">
                      <label>Lokasi Kerja</label>
                      <select
                        value={checkInLocationId}
                        onChange={(e) => setCheckInLocationId(e.target.value)}
                        className="daily-modal-select"
                      >
                        <option value="">Pilih Lokasi Kerja</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="daily-subcard-field">
                      <label>Status</label>
                      <select
                        value={checkInStatus}
                        onChange={(e) => setCheckInStatus(e.target.value)}
                        className="daily-modal-select"
                      >
                        <option value="present">Hadir</option>
                        <option value="late">Terlambat</option>
                        <option value="leave">Izin</option>
                        <option value="absent">Alpa</option>
                      </select>
                    </div>

                    <div className="daily-subcard-field">
                      <label>Keterangan</label>
                      <textarea
                        value={checkInNote}
                        onChange={(e) => setCheckInNote(e.target.value)}
                        placeholder="Kehadiran masuk karyawan"
                        rows={2}
                        className="daily-modal-textarea"
                      />
                    </div>

                  </div>
                </div>

                {/* CARD 2: KELUAR */}
                <div className="daily-subcard card-keluar">
                  <header className="daily-subcard-header header-keluar">
                    <span className="dot dot-blue" />
                    <h3>Keluar</h3>
                  </header>

                  <div className="daily-subcard-body">
                    <div className="daily-subcard-field">
                      <label>Jam Keluar</label>
                      <input
                        type="time"
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="daily-modal-input"
                      />
                    </div>

                    <div className="daily-subcard-field">
                      <label>Lokasi Kerja</label>
                      <select
                        value={checkOutLocationId}
                        onChange={(e) => setCheckOutLocationId(e.target.value)}
                        className="daily-modal-select"
                      >
                        <option value="">Pilih Lokasi Kerja</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="daily-subcard-field">
                      <label>Status</label>
                      <select
                        value={checkOutStatus}
                        onChange={(e) => setCheckOutStatus(e.target.value)}
                        className="daily-modal-select"
                      >
                        <option value="present">Pulang Kerja</option>
                        <option value="late">Lembur</option>
                        <option value="absent">Alpa</option>
                      </select>
                    </div>

                    <div className="daily-subcard-field">
                      <label>Keterangan</label>
                      <textarea
                        value={checkOutNote}
                        onChange={(e) => setCheckOutNote(e.target.value)}
                        placeholder="Kehadiran keluar karyawan"
                        rows={2}
                        className="daily-modal-textarea"
                      />
                    </div>

                  </div>
                </div>

                {/* CARD 3: ISTIRAHAT */}
                <div className="daily-subcard card-istirahat">
                  <header className="daily-subcard-header header-istirahat">
                    <span className="dot dot-amber" />
                    <h3>Istirahat (Opsional)</h3>
                  </header>

                  <div className="daily-subcard-body">
                    <div className="daily-subcard-field">
                      <label>Jam Mulai Istirahat</label>
                      <input
                        type="time"
                        value={breakStartTime}
                        onChange={(e) => setBreakStartTime(e.target.value)}
                        className="daily-modal-input"
                      />
                    </div>

                    <div className="daily-subcard-field">
                      <label>Jam Selesai Istirahat</label>
                      <input
                        type="time"
                        value={breakEndTime}
                        onChange={(e) => setBreakEndTime(e.target.value)}
                        className="daily-modal-input"
                      />
                    </div>

                    <div className="daily-subcard-field">
                      <label>Keterangan Istirahat</label>
                      <textarea
                        value={breakNote}
                        onChange={(e) => setBreakNote(e.target.value)}
                        placeholder="Catatan istirahat (opsional)"
                        rows={5}
                        className="daily-modal-textarea"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer className="daily-modal-footer">
              <div className="daily-modal-footer-info">
                {errorMsg ? (
                  <span className="daily-modal-error">
                    <AlertCircle size={15} /> {errorMsg}
                  </span>
                ) : null}
              </div>

              <div className="daily-modal-footer-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="daily-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>{submitting ? "Menyimpan..." : "Simpan Kehadiran"}</span>
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
    </>
  );
}

// =========================================================================
// Helpers & Subcomponents
// =========================================================================
function StatusBadgeView({ status, hasRecord }: { status: string; hasRecord: boolean }) {
  if (!hasRecord) {
    return <span className="status-pill status-unrecorded">Belum Tercatat</span>;
  }
  switch (status) {
    case "present":
      return <span className="status-pill status-present">Hadir</span>;
    case "late":
      return <span className="status-pill status-late">Terlambat</span>;
    case "leave":
      return <span className="status-pill status-leave">Izin</span>;
    case "absent":
      return <span className="status-pill status-absent">Alpa</span>;
    default:
      return <span className="status-pill">{status}</span>;
  }
}

function formatDisplayDate(dateStr: string) {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}
