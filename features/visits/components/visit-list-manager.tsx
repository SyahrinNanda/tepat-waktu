"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  Inbox,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { CAMERA_SELFIE_SOURCE, VisitSelfieCamera } from "@/features/visits/components/visit-selfie-camera";
import { VisitDatePopover } from "@/features/visits/components/visit-date-popover";
import type { VisitEmployeeOption, VisitRow } from "@/features/visits/types";

type Props = {
  initialRows: VisitRow[];
  employees: VisitEmployeeOption[];
  today: string;
  canWrite: boolean;
  /** Everyone except company admins must take the selfie with the live camera (no upload). */
  selfieCameraOnly?: boolean;
};

export function VisitListManager({ initialRows, employees, today, canWrite, selfieCameraOnly = false }: Props) {
  const [rows, setRows] = useState<VisitRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateLabel, setDateLabel] = useState("");

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportingPhotos, setExportingPhotos] = useState(false);
  const [error, setError] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const employeePickerRef = useRef<HTMLDivElement>(null);

  // Form states for Modal
  const [formDate, setFormDate] = useState(today);
  const [selectedEmployee, setSelectedEmployee] = useState<VisitEmployeeOption | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [formNote, setFormNote] = useState("");

  // Files
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [selfieFromCamera, setSelfieFromCamera] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [att1File, setAtt1File] = useState<File | null>(null);
  const [att1Preview, setAtt1Preview] = useState<string | null>(null);
  const att1InputRef = useRef<HTMLInputElement>(null);

  const [att2File, setAtt2File] = useState<File | null>(null);
  const [att2Preview, setAtt2Preview] = useState<string | null>(null);
  const att2InputRef = useRef<HTMLInputElement>(null);

  const [att3File, setAtt3File] = useState<File | null>(null);
  const [att3Preview, setAtt3Preview] = useState<string | null>(null);
  const att3InputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePopoverOpen(false);
      }
      if (employeePickerRef.current && !employeePickerRef.current.contains(event.target as Node)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        const matchSearch =
          !query.trim() ||
          `${row.employeeName} ${row.employeeCode} ${row.outletName}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchDate = (!from || row.visitDate >= from) && (!to || row.visitDate <= to);
        return matchSearch && matchDate;
      }),
    [rows, query, from, to],
  );

  const exportQuery = () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  };

  const handleExportReport = async () => {
    setMenuOpen(false);
    setExportingReport(true);
    try {
      const q = exportQuery();
      const res = await fetch(`/api/visits/export${q ? `?${q}` : ""}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Gagal mengunduh laporan kunjungan.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "laporan-kunjungan.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal mengunduh laporan kunjungan.");
    } finally {
      setExportingReport(false);
    }
  };

  const handleExportPhotos = async () => {
    setMenuOpen(false);
    setExportingPhotos(true);
    try {
      const q = exportQuery();
      const res = await fetch(`/api/visits/photos${q ? `?${q}` : ""}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Gagal mengunduh foto lampiran.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "foto-lampiran-kunjungan.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal mengunduh foto lampiran.");
    } finally {
      setExportingPhotos(false);
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setFrom("");
    setTo("");
    setDateLabel("");
    setDatePopoverOpen(false);
  };

  const openAddModal = () => {
    // Employees can only record their own visits, so their single option is preselected.
    setSelectedEmployee(employees.length === 1 ? employees[0] : null);
    setEmployeeSearch("");
    setOutletName("");
    setFormDate(today);
    setFormNote("");
    setSelfieFile(null);
    setSelfiePreview(null);
    setSelfieFromCamera(false);
    setAtt1File(null);
    setAtt1Preview(null);
    setAtt2File(null);
    setAtt2Preview(null);
    setAtt3File(null);
    setAtt3Preview(null);
    setError("");
    setModalOpen(true);
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const term = employeeSearch.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(term) || e.employeeCode.toLowerCase().includes(term),
    );
  }, [employees, employeeSearch]);

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setError("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (!outletName.trim()) {
      setError("Lokasi outlet wajib diisi.");
      return;
    }
    if (selfieCameraOnly && !(selfieFile && selfieFromCamera)) {
      setError("Foto selfie wajib diambil langsung dari kamera.");
      return;
    }

    setSaving(true);
    setError("");

    const formData = new FormData();
    formData.append("employeeId", selectedEmployee.id);
    formData.append("visitDate", formDate);
    formData.append("outletName", outletName.trim());
    if (formNote) formData.append("note", formNote);

    if (selfieFile) formData.append("selfie", selfieFile);
    if (selfieFile && selfieFromCamera) formData.append("selfieSource", CAMERA_SELFIE_SOURCE);
    if (att1File) formData.append("attachment1", att1File);
    if (att2File) formData.append("attachment2", att2File);
    if (att3File) formData.append("attachment3", att3File);

    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan kunjungan.");
        setSaving(false);
        return;
      }

      // Refresh list
      const refreshed = await fetch("/api/visits", { cache: "no-store" }).then((r) => r.json());
      setRows(refreshed.rows || []);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat menyimpan kunjungan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="visit-page-head">
        <small>Kehadiran Admin Panel</small>
        <h1>Daftar Kunjungan</h1>
      </header>

      <section className="visit-card">
        {/* TOOLBAR */}
        <div className="visit-toolbar">
          {/* Search box */}
          <label className="visit-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama karyawan ..."
            />
          </label>

          {/* Date Range Popover Button */}
          <div className="visit-date-filter-wrapper" ref={datePickerRef}>
            <div
              className={`visit-date-display ${datePopoverOpen ? "active" : ""}`}
              onClick={() => setDatePopoverOpen((prev) => !prev)}
            >
              <span>{dateLabel || "Filter Tanggal"}</span>
              <button
                type="button"
                className="visit-cal-btn"
                title="Buka kalender"
                onClick={(e) => {
                  e.stopPropagation();
                  setDatePopoverOpen((prev) => !prev);
                }}
              >
                <Calendar size={15} />
              </button>
            </div>

            {datePopoverOpen && (
              <VisitDatePopover
                initialFrom={from}
                initialTo={to}
                onApply={(f, t, label) => {
                  setFrom(f);
                  setTo(t);
                  setDateLabel(label);
                  setDatePopoverOpen(false);
                }}
                onCancel={() => setDatePopoverOpen(false)}
              />
            )}
          </div>

          {/* Reset button */}
          <button
            className="visit-reset"
            type="button"
            title="Reset filter"
            onClick={handleResetFilters}
          >
            <RotateCcw size={17} />
          </button>

          <span className="visit-toolbar-spacer" />

          {/* Tambah Kunjungan Button */}
          {canWrite && (
            <button className="visit-add" type="button" onClick={openAddModal}>
              <Plus size={17} />
              Tambah Kunjungan
            </button>
          )}

          {/* More actions button (three dots) */}
          <div className="visit-more-wrap" ref={menuRef}>
            <button
              className="visit-more"
              type="button"
              aria-label="Menu opsi"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className="visit-export-menu">
                <button
                  type="button"
                  className="visit-export-item"
                  onClick={handleExportReport}
                  disabled={exportingReport}
                >
                  {exportingReport ? <Loader2 size={14} className="spin" /> : null}
                  Ekspor Laporan Kunjungan
                </button>
                <button
                  type="button"
                  className="visit-export-item"
                  onClick={handleExportPhotos}
                  disabled={exportingPhotos}
                >
                  {exportingPhotos ? <Loader2 size={14} className="spin" /> : null}
                  Ekspor Foto Lampiran
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="visit-table-wrap">
          <table className="visit-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Nomor Induk</th>
                <th>Tanggal Kunjungan</th>
                <th>Outlet</th>
                <th>Jam</th>
                <th>Koordinat</th>
                <th>Lampiran</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.employeeName}</strong>
                  </td>
                  <td>{row.employeeCode}</td>
                  <td>{formatDate(row.visitDate)}</td>
                  <td>{row.outletName}</td>
                  <td>{row.visitTime.slice(0, 5)}</td>
                  <td>
                    {row.latitude != null && row.longitude != null ? (
                      <span className="visit-coordinate">
                        <MapPin size={13} />
                        {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{row.attachmentCount} foto</td>
                  <td>
                    <span className="visit-status">{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {!visible.length && (
            <div className="visit-empty-container">
              <div className="visit-empty-illustration">
                <div className="visit-empty-cloud"></div>
                <div className="visit-empty-box">
                  <Inbox size={42} />
                </div>
              </div>
              <strong className="visit-empty-title">Data Kosong</strong>
              <span className="visit-empty-desc">Belum ada kunjungan pada filter ini.</span>
            </div>
          )}
        </div>

        {visible.length > 0 && (
          <footer className="visit-footer">
            Menampilkan {visible.length} dari {rows.length} kunjungan
          </footer>
        )}
      </section>

      {/* MODAL TAMBAH KUNJUNGAN */}
      {modalOpen && (
        <div
          className="visit-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="visit-modal" role="dialog" aria-modal="true" aria-labelledby="visit-modal-title">
            <header className="visit-modal-head">
              <h2 id="visit-modal-title">Tambah kunjungan</h2>
              <button
                type="button"
                className="visit-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSaveVisit}>
              <div className="visit-modal-content">
                {/* TOP ROW: Tanggal Kunjungan & Karyawan Autocomplete */}
                <div className="visit-modal-top-row">
                  {/* Tanggal Kunjungan */}
                  <div className="visit-field-group">
                    <label className="visit-label">Tanggal Kunjungan</label>
                    <div className="visit-date-input-wrap">
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        required
                        className="visit-input"
                      />
                    </div>
                  </div>

                  {/* Karyawan (Searchable Autocomplete) */}
                  <div className="visit-field-group">
                    <label className="visit-label">Karyawan</label>
                    <div className="visit-autocomplete-wrap" ref={employeePickerRef}>
                      <div className="visit-autocomplete-box">
                        <input
                          type="text"
                          placeholder="Pilih karyawan..."
                          value={selectedEmployee ? selectedEmployee.name : employeeSearch}
                          onFocus={() => setEmployeeDropdownOpen(true)}
                          onClick={() => setEmployeeDropdownOpen(true)}
                          onChange={(e) => {
                            setSelectedEmployee(null);
                            setEmployeeSearch(e.target.value);
                            setEmployeeDropdownOpen(true);
                          }}
                          className="visit-input"
                          required={!selectedEmployee}
                        />
                        {(selectedEmployee || employeeSearch) && (
                          <button
                            type="button"
                            className="visit-autocomplete-clear"
                            onClick={() => {
                              setSelectedEmployee(null);
                              setEmployeeSearch("");
                              setEmployeeDropdownOpen(false);
                            }}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown list */}
                      {employeeDropdownOpen && (
                        <div className="visit-autocomplete-dropdown">
                          {filteredEmployees.length === 0 ? (
                            <div className="visit-dropdown-empty">Karyawan tidak ditemukan</div>
                          ) : (
                            filteredEmployees.map((emp) => {
                              const isSelected = selectedEmployee?.id === emp.id;
                              return (
                                <div
                                  key={emp.id}
                                  className={`visit-dropdown-item ${isSelected ? "selected" : ""}`}
                                  onClick={() => {
                                    setSelectedEmployee(emp);
                                    setEmployeeSearch(emp.name);
                                    setEmployeeDropdownOpen(false);
                                  }}
                                >
                                  <span>{emp.name}</span>
                                  {emp.employeeCode ? <small>({emp.employeeCode})</small> : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* MAIN BODY: 2 Columns */}
                <div className="visit-modal-body-cols">
                  {/* LEFT COLUMN: Detail Kunjungan */}
                  <div className="visit-modal-card">
                    <h3 className="visit-card-title">Detail Kunjungan</h3>
                    <div className="visit-card-fields">
                      <div className="visit-field-group">
                        <label className="visit-label">Lokasi Outlet</label>
                        <input
                          type="text"
                          value={outletName}
                          onChange={(e) => setOutletName(e.target.value)}
                          className="visit-input"
                          placeholder="Contoh: Toko Sumber Rezeki, Jl. Merdeka 12"
                          maxLength={160}
                          required
                        />
                      </div>

                      <div className="visit-field-group">
                        <label className="visit-label">Jam</label>
                        <input
                          type="text"
                          value="Otomatis saat disimpan"
                          className="visit-input"
                          readOnly
                          disabled
                        />
                      </div>

                      <div className="visit-field-group">
                        <label className="visit-label">Keterangan</label>
                        <textarea
                          rows={4}
                          placeholder="Keterangan Kunjungan..."
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          className="visit-textarea"
                        />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Foto Selfie & Lampiran */}
                  <div className="visit-modal-right-col">
                    {/* TOP: Foto Selfie */}
                    <div className="visit-modal-card">
                      <h3 className="visit-card-title">Foto Selfie</h3>
                      <div className="visit-upload-box selfie">
                        {selfiePreview ? (
                          <div className="visit-preview-box">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selfiePreview} alt="Selfie preview" className="visit-preview-img" />
                            <div className="visit-preview-actions">
                              <span className="visit-preview-name">{selfieFile?.name}</span>
                              <button
                                type="button"
                                className="visit-preview-remove"
                                onClick={() => {
                                  setSelfieFile(null);
                                  setSelfiePreview(null);
                                  setSelfieFromCamera(false);
                                }}
                              >
                                <X size={14} /> Hapus
                              </button>
                            </div>
                          </div>
                        ) : selfieCameraOnly ? (
                          <>
                            <Camera size={32} className="visit-upload-icon" />
                            <p className="visit-upload-text">Foto selfie wajib diambil langsung dari kamera</p>
                            <button type="button" className="visit-btn-cari" onClick={() => setCameraOpen(true)}>
                              Buka Kamera
                            </button>
                          </>
                        ) : (
                          <>
                            <Upload size={32} className="visit-upload-icon" />
                            <p className="visit-upload-text">Upload foto selfie karyawan</p>
                            <button type="button" className="visit-btn-cari" onClick={() => setCameraOpen(true)}>
                              Buka Kamera
                            </button>
                            <button
                              type="button"
                              className="visit-btn-cari"
                              onClick={() => selfieInputRef.current?.click()}
                            >
                              Cari Gambar
                            </button>
                            <input
                              type="file"
                              ref={selfieInputRef}
                              accept="image/jpeg,image/png,image/webp"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setSelfieFile(f);
                                  setSelfiePreview(URL.createObjectURL(f));
                                  setSelfieFromCamera(false);
                                }
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* BOTTOM: Lampiran (3 Boxes) */}
                    <div className="visit-modal-card">
                      <h3 className="visit-card-title">Lampiran</h3>
                      <div className="visit-lampiran-grid">
                        {/* Slot 1 */}
                        <div className="visit-upload-box lampiran">
                          {att1Preview ? (
                            <div className="visit-preview-box">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att1Preview} alt="Lampiran 1" className="visit-preview-img" />
                              <button
                                type="button"
                                className="visit-mini-remove"
                                onClick={() => {
                                  setAtt1File(null);
                                  setAtt1Preview(null);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload size={24} className="visit-upload-icon" />
                              <p className="visit-upload-text">Tambah lampiran kunjungan</p>
                              <button
                                type="button"
                                className="visit-btn-cari sm"
                                onClick={() => att1InputRef.current?.click()}
                              >
                                Cari Gambar
                              </button>
                              <input
                                type="file"
                                ref={att1InputRef}
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setAtt1File(f);
                                    setAtt1Preview(URL.createObjectURL(f));
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>

                        {/* Slot 2 */}
                        <div className="visit-upload-box lampiran">
                          {att2Preview ? (
                            <div className="visit-preview-box">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att2Preview} alt="Lampiran 2" className="visit-preview-img" />
                              <button
                                type="button"
                                className="visit-mini-remove"
                                onClick={() => {
                                  setAtt2File(null);
                                  setAtt2Preview(null);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload size={24} className="visit-upload-icon" />
                              <p className="visit-upload-text">Tambah lampiran kunjungan</p>
                              <button
                                type="button"
                                className="visit-btn-cari sm"
                                onClick={() => att2InputRef.current?.click()}
                              >
                                Cari Gambar
                              </button>
                              <input
                                type="file"
                                ref={att2InputRef}
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setAtt2File(f);
                                    setAtt2Preview(URL.createObjectURL(f));
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>

                        {/* Slot 3 */}
                        <div className="visit-upload-box lampiran">
                          {att3Preview ? (
                            <div className="visit-preview-box">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att3Preview} alt="Lampiran 3" className="visit-preview-img" />
                              <button
                                type="button"
                                className="visit-mini-remove"
                                onClick={() => {
                                  setAtt3File(null);
                                  setAtt3Preview(null);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload size={24} className="visit-upload-icon" />
                              <p className="visit-upload-text">Tambah lampiran kunjungan</p>
                              <button
                                type="button"
                                className="visit-btn-cari sm"
                                onClick={() => att3InputRef.current?.click()}
                              >
                                Cari Gambar
                              </button>
                              <input
                                type="file"
                                ref={att3InputRef}
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setAtt3File(f);
                                    setAtt3Preview(URL.createObjectURL(f));
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="visit-modal-error">{error}</div>}
              </div>

              {/* FOOTER */}
              <footer className="visit-modal-footer">
                <button
                  type="button"
                  className="visit-modal-cancel"
                  onClick={() => setModalOpen(false)}
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="visit-modal-submit"
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      {cameraOpen && (
        <VisitSelfieCamera
          onClose={() => setCameraOpen(false)}
          onCapture={(file, url) => {
            setSelfieFile(file);
            setSelfiePreview(url);
            setSelfieFromCamera(true);
            setCameraOpen(false);
          }}
        />
      )}
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
