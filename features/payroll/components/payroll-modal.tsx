"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CloudUpload,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import type { PayrollEmployeeOption } from "@/features/payroll/types";

const MONTH_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const YEAR_OPTIONS = [
  2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
];

function formatRupiah(amount: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(amount);
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  employees: PayrollEmployeeOption[];
  onSuccess: () => void;
  defaultMonth?: number;
  defaultYear?: number;
};

export function PayrollModal({
  isOpen,
  onClose,
  employees,
  onSuccess,
  defaultMonth,
  defaultYear,
}: Props) {
  const now = new Date();
  const currentMonth = defaultMonth || now.getMonth() + 1;
  const currentYear = defaultYear || now.getFullYear();

  const [activeTab, setActiveTab] = useState<"salary" | "slip">("salary");

  // Form states
  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [selectedEmployee, setSelectedEmployee] =
    useState<PayrollEmployeeOption | null>(null);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [quantity, setQuantity] = useState<number>(0);
  const [salaryType, setSalaryType] = useState<string>("Bulan");
  const [rate, setRate] = useState<number>(0);

  // File slip
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputId = useId();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const employeePickerRef = useRef<HTMLDivElement>(null);

  // Close employee dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        employeePickerRef.current &&
        !employeePickerRef.current.contains(e.target as Node)
      ) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filtered employees for dropdown
  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const term = employeeSearch.toLowerCase().trim();
    return (
      emp.name.toLowerCase().includes(term) ||
      emp.employeeCode.toLowerCase().includes(term)
    );
  });

  const totalAmount = Math.max(0, Math.round(quantity * rate));

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type) && !/\.(pdf|jpg|jpeg|png)$/i.test(file.name)) {
      setError("Format file harus PDF, JPG, atau PNG.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Ukuran file maksimal 8 MB.");
      return;
    }
    setError("");
    setSlipFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setActiveTab("salary");
      setError("Silakan pilih karyawan terlebih dahulu.");
      return;
    }

    setBusy(true);
    setError("");

    const formData = new FormData();
    formData.append("employeeId", selectedEmployee.id);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("salaryType", salaryType);
    formData.append("quantity", String(quantity));
    formData.append("rate", String(rate));

    if (slipFile) {
      formData.append("slip", slipFile);
    }

    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan payroll.");
        setBusy(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Terjadi kesalahan pada server saat menyimpan payroll.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="payroll-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="payroll-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-modal-title"
      >
        {/* MODAL HEADER */}
        <div className="payroll-modal-header">
          <h2 id="payroll-modal-title" className="payroll-modal-title">
            Tambah Payroll
          </h2>
          <button
            type="button"
            className="payroll-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* TABS (Gambar 8, 9) */}
        <div className="payroll-modal-tabs">
          <button
            type="button"
            className={`payroll-modal-tab-btn ${
              activeTab === "salary" ? "active" : ""
            }`}
            onClick={() => setActiveTab("salary")}
          >
            <MessageSquare size={16} />
            <span>Salary Details</span>
          </button>
          <button
            type="button"
            className={`payroll-modal-tab-btn ${
              activeTab === "slip" ? "active" : ""
            }`}
            onClick={() => setActiveTab("slip")}
          >
            <FileText size={16} />
            <span>Upload Slip</span>
            {slipFile && <span className="payroll-tab-dot" />}
          </button>
        </div>

        {error && (
          <div className="payroll-modal-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="payroll-modal-form">
          {/* TAB 1: SALARY DETAILS (Gambar 9, 10, 11) */}
          <div
            style={{ display: activeTab === "salary" ? "block" : "none" }}
            className="payroll-tab-content"
          >
            {/* ROW 1: Bulan, Tahun, Karyawan */}
            <div className="payroll-form-row-3">
              {/* Bulan Dropdown */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Bulan</label>
                <select
                  className="payroll-form-select"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun Dropdown */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Tahun</label>
                <select
                  className="payroll-form-select"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Karyawan Dropdown Autocomplete (Gambar 10) */}
              <div
                className="payroll-form-field"
                ref={employeePickerRef}
                style={{ position: "relative" }}
              >
                <label className="payroll-form-label">Karyawan</label>
                <div
                  className="payroll-form-select payroll-employee-picker-trigger"
                  onClick={() => setEmployeeDropdownOpen((open) => !open)}
                >
                  <span
                    className={
                      selectedEmployee
                        ? "payroll-text-selected"
                        : "payroll-text-placeholder"
                    }
                  >
                    {selectedEmployee
                      ? `${selectedEmployee.name} (${selectedEmployee.employeeCode})`
                      : "Nama Karyawan..."}
                  </span>
                  <ChevronDown size={15} className="payroll-chevron-icon" />
                </div>

                {employeeDropdownOpen && (
                  <div className="payroll-employee-popover">
                    <div className="payroll-employee-search-wrap">
                      <Search size={14} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Cari karyawan..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="payroll-employee-search-input"
                      />
                    </div>
                    <div className="payroll-employee-list">
                      {filteredEmployees.length === 0 ? (
                        <div className="payroll-employee-empty">
                          Karyawan tidak ditemukan
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className={`payroll-employee-item ${
                              selectedEmployee?.id === emp.id ? "selected" : ""
                            }`}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setEmployeeDropdownOpen(false);
                              if (emp.baseSalary && emp.baseSalary > 0) {
                                setRate(emp.baseSalary);
                                if (quantity === 0) setQuantity(1);
                              }
                            }}
                          >
                            <div className="payroll-employee-item-info">
                              <strong>{emp.name}</strong>
                              <span>{emp.employeeCode}</span>
                            </div>
                            {selectedEmployee?.id === emp.id && (
                              <Check size={16} className="text-blue-600" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DIVIDER: Form Input Gaji (Gambar 9) */}
            <div className="payroll-divider-row">
              <span className="payroll-divider-line" />
              <span className="payroll-divider-text">Form Input Gaji</span>
              <span className="payroll-divider-line" />
            </div>

            {/* ROW 2: Jumlah Gaji, Type Gaji, Nominal Gaji, Total Gaji (Gambar 9, 11) */}
            <div className="payroll-form-row-4">
              {/* Jumlah Gaji */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Jumlah Gaji</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="payroll-form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              {/* Type Gaji (Gambar 11) */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Type Gaji</label>
                <select
                  className="payroll-form-select"
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="" disabled>
                    Type Gaji
                  </option>
                  <option value="Jam">Jam</option>
                  <option value="Hari">Hari</option>
                  <option value="Bulan">Bulan</option>
                </select>
              </div>

              {/* Nominal Gaji */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Nominal Gaji</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="payroll-form-input"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              {/* Total Gaji */}
              <div className="payroll-form-field">
                <label className="payroll-form-label">Total Gaji</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  className="payroll-form-input readonly"
                  value={formatRupiah(totalAmount)}
                />
              </div>
            </div>
          </div>

          {/* TAB 2: UPLOAD SLIP (Gambar 8) */}
          <div
            style={{ display: activeTab === "slip" ? "block" : "none" }}
            className="payroll-tab-content"
          >
            <div
              className={`payroll-upload-dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              <label
                htmlFor={fileInputId}
                className="payroll-upload-dropzone-label"
              >
                <div className="payroll-upload-icon-circle">
                  <CloudUpload size={28} />
                </div>
                <h4 className="payroll-upload-heading">
                  Drag & Drop or Choose file to upload
                </h4>
                <p className="payroll-upload-subtext">
                  Supported formats : .pdf, .jpg, .png
                </p>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="payroll-file-input-hidden"
                />
              </label>

              {slipFile && (
                <div className="payroll-uploaded-file-card">
                  <div className="payroll-uploaded-file-info">
                    <FileText size={20} className="text-blue-600" />
                    <div>
                      <strong>{slipFile.name}</strong>
                      <span>
                        {(slipFile.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="payroll-uploaded-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlipFile(null);
                    }}
                    title="Hapus file"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER (Gambar 8, 9) */}
          <div className="payroll-modal-footer">
            <button
              type="button"
              className="payroll-modal-btn-cancel"
              onClick={onClose}
              disabled={busy}
            >
              Batalkan
            </button>
            <button
              type="submit"
              className="payroll-modal-btn-submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>MENYIMPAN...</span>
                </>
              ) : (
                "TAMBAH"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
