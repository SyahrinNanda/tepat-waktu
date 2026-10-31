"use client";

import { useEffect, useId, useState } from "react";
import {
  CloudUpload,
  FileText,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { PayrollItemRow, PayrollRow, PayrollTermRow } from "@/features/payroll/types";

function formatRupiah(amount: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(amount);
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  payroll: PayrollRow | null;
  terms: PayrollTermRow[];
  onUpdated: () => void;
};

export function PayrollEditModal({
  isOpen,
  onClose,
  payroll,
  terms,
  onUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<"gaji" | "kompensasi" | "potongan" | "slip">("gaji");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tab Gaji Edit Mode
  const [isEditingGaji, setIsEditingGaji] = useState(false);
  const [editSalaryType, setEditSalaryType] = useState("bulan");
  const [editRate, setEditRate] = useState(0);
  const [editQuantity, setEditQuantity] = useState(1);

  // Tab Kompensasi & Potongan items
  const [items, setItems] = useState<PayrollItemRow[]>([]);
  const [klaimBebanNominal, setKlaimBebanNominal] = useState(0);
  const [klaimBebanQty, setKlaimBebanQty] = useState(1);

  const [kasbonNominal, setKasbonNominal] = useState(0);
  const [kasbonQty, setKasbonQty] = useState(1);
  const [kasbonType, setKasbonType] = useState("bulan");

  // Dynamic rows added before save
  const [dynamicCompRows, setDynamicCompRows] = useState<
    Array<{ id?: string; name: string; rate: number; quantity: number }>
  >([]);

  const [dynamicDeductRows, setDynamicDeductRows] = useState<
    Array<{ id?: string; name: string; rate: number; quantity: number; salaryType: string }>
  >([]);

  // Slip upload
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [existingSlipAssetId, setExistingSlipAssetId] = useState<string | null>(null);
  const [existingSlipName, setExistingSlipName] = useState<string | null>(null);
  const fileInputId = useId();

  // Compensation and Deduction terms options
  const compensationTerms = terms.filter((t) => t.type === "compensation" && t.active);
  const deductionTerms = terms.filter((t) => t.type === "deduction" && t.active);

  // Load detail from backend when modal opens
  const loadDetail = async (pId: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/payroll/${pId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat detail payroll.");
        return;
      }

      const p: PayrollRow = data.payroll;
      setEditSalaryType(p.salaryType.toLowerCase());
      setEditRate(p.rate);
      setEditQuantity(p.quantity);
      setExistingSlipAssetId(p.slipAssetId);
      setExistingSlipName(p.slipOriginalName || null);

      const loadedItems: PayrollItemRow[] = data.items || [];
      setItems(loadedItems);

      // Extract Klaim Beban if exists
      const kb = loadedItems.find((i) => i.category === "compensation" && i.name === "Klaim Beban");
      if (kb) {
        setKlaimBebanNominal(kb.rate);
        setKlaimBebanQty(kb.quantity);
      } else {
        setKlaimBebanNominal(0);
        setKlaimBebanQty(1);
      }

      // Extract Kasbon if exists
      const kbDeduct = loadedItems.find((i) => i.category === "deduction" && i.name === "Kasbon");
      if (kbDeduct) {
        setKasbonNominal(kbDeduct.rate);
        setKasbonQty(kbDeduct.quantity);
        setKasbonType(kbDeduct.salaryType || "bulan");
      } else {
        setKasbonNominal(0);
        setKasbonQty(1);
        setKasbonType("bulan");
      }

      // Populate other dynamic compensation items
      const otherComps = loadedItems.filter(
        (i) => i.category === "compensation" && i.name !== "Klaim Beban",
      );
      setDynamicCompRows(
        otherComps.map((i) => ({
          id: i.id,
          name: i.name,
          rate: i.rate,
          quantity: i.quantity,
        })),
      );

      // Populate other dynamic deduction items
      const otherDeducts = loadedItems.filter(
        (i) => i.category === "deduction" && i.name !== "Kasbon",
      );
      setDynamicDeductRows(
        otherDeducts.map((i) => ({
          id: i.id,
          name: i.name,
          rate: i.rate,
          quantity: i.quantity,
          salaryType: i.salaryType || "bulan",
        })),
      );
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  const payrollId = payroll?.id;

  useEffect(() => {
    if (!payrollId) return;
    let ignore = false;
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/payroll/${payrollId}`, { cache: "no-store" });
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) {
          setError(data.error || "Gagal memuat detail payroll.");
          return;
        }

        const p: PayrollRow = data.payroll;
        setEditSalaryType(p.salaryType.toLowerCase());
        setEditRate(p.rate);
        setEditQuantity(p.quantity);
        setExistingSlipAssetId(p.slipAssetId);
        setExistingSlipName(p.slipOriginalName || null);

        const loadedItems: PayrollItemRow[] = data.items || [];
        setItems(loadedItems);

        // Extract Klaim Beban if exists
        const kb = loadedItems.find((i) => i.category === "compensation" && i.name === "Klaim Beban");
        if (kb) {
          setKlaimBebanNominal(kb.rate);
          setKlaimBebanQty(kb.quantity);
        } else {
          setKlaimBebanNominal(0);
          setKlaimBebanQty(1);
        }

        // Extract Kasbon if exists
        const kbDeduct = loadedItems.find((i) => i.category === "deduction" && i.name === "Kasbon");
        if (kbDeduct) {
          setKasbonNominal(kbDeduct.rate);
          setKasbonQty(kbDeduct.quantity);
          setKasbonType(kbDeduct.salaryType || "bulan");
        } else {
          setKasbonNominal(0);
          setKasbonQty(1);
          setKasbonType("bulan");
        }

        // Populate other dynamic compensation items
        const otherComps = loadedItems.filter(
          (i) => i.category === "compensation" && i.name !== "Klaim Beban",
        );
        setDynamicCompRows(
          otherComps.map((i) => ({
            id: i.id,
            name: i.name,
            rate: i.rate,
            quantity: i.quantity,
          })),
        );

        // Populate other dynamic deduction items
        const otherDeducts = loadedItems.filter(
          (i) => i.category === "deduction" && i.name !== "Kasbon",
        );
        setDynamicDeductRows(
          otherDeducts.map((i) => ({
            id: i.id,
            name: i.name,
            rate: i.rate,
            quantity: i.quantity,
            salaryType: i.salaryType || "bulan",
          })),
        );
      } catch {
        if (!ignore) setError("Gagal menghubungi server.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void fetchDetail();
    return () => {
      ignore = true;
    };
  }, [payrollId]);

  if (!isOpen || !payroll) return null;

  // Handle Save / Toggle Gaji
  const handleToggleOrSaveGaji = async () => {
    if (!isEditingGaji) {
      setIsEditingGaji(true);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/payroll/${payroll.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          salaryType: editSalaryType,
          quantity: editQuantity,
          rate: editRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan perubahan gaji.");
        return;
      }
      setIsEditingGaji(false);
      setSuccess("Detail gaji berhasil diperbarui.");
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Klaim Beban
  const handleSaveKlaimBeban = async () => {
    setSaving(true);
    setError("");
    try {
      const kb = items.find((i) => i.category === "compensation" && i.name === "Klaim Beban");
      const res = await fetch(`/api/payroll/${payroll.id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: kb?.id,
          category: "compensation",
          name: "Klaim Beban",
          rate: klaimBebanNominal,
          quantity: klaimBebanQty,
          salaryType: "bulan",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan klaim beban.");
        return;
      }
      setSuccess("Klaim beban berhasil disimpan.");
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat menyimpan klaim beban.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Kasbon
  const handleSaveKasbon = async () => {
    setSaving(true);
    setError("");
    try {
      const kb = items.find((i) => i.category === "deduction" && i.name === "Kasbon");
      const res = await fetch(`/api/payroll/${payroll.id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: kb?.id,
          category: "deduction",
          name: "Kasbon",
          rate: kasbonNominal,
          quantity: kasbonQty,
          salaryType: kasbonType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan kasbon.");
        return;
      }
      setSuccess("Kasbon berhasil disimpan.");
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat menyimpan kasbon.");
    } finally {
      setSaving(false);
    }
  };

  // Add Dynamic Compensation Row
  const handleAddCompRow = () => {
    setDynamicCompRows((prev) => [...prev, { name: "", rate: 0, quantity: 1 }]);
  };

  // Save Dynamic Comp Row
  const handleSaveDynamicComp = async (idx: number) => {
    const row = dynamicCompRows[idx];
    if (!row.name) {
      setError("Pilih nama kompensasi terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/payroll/${payroll.id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          category: "compensation",
          name: row.name,
          rate: row.rate,
          quantity: row.quantity,
          salaryType: "bulan",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan kompensasi.");
        return;
      }
      setSuccess(`Kompensasi "${row.name}" berhasil disimpan.`);
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat menyimpan kompensasi.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Comp Row
  const handleDeleteCompRow = async (idx: number) => {
    const row = dynamicCompRows[idx];
    if (!row.id) {
      setDynamicCompRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/payroll/${payroll.id}/items/${row.id}`, { method: "DELETE" });
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Gagal menghapus kompensasi.");
    } finally {
      setSaving(false);
    }
  };

  // Add Dynamic Deduction Row
  const handleAddDeductRow = () => {
    setDynamicDeductRows((prev) => [
      ...prev,
      { name: "", rate: 0, quantity: 1, salaryType: "bulan" },
    ]);
  };

  // Save Dynamic Deduct Row
  const handleSaveDynamicDeduct = async (idx: number) => {
    const row = dynamicDeductRows[idx];
    if (!row.name) {
      setError("Pilih nama potongan terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/payroll/${payroll.id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          category: "deduction",
          name: row.name,
          rate: row.rate,
          quantity: row.quantity,
          salaryType: row.salaryType || "bulan",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan potongan.");
        return;
      }
      setSuccess(`Potongan "${row.name}" berhasil disimpan.`);
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat menyimpan potongan.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Deduct Row
  const handleDeleteDeductRow = async (idx: number) => {
    const row = dynamicDeductRows[idx];
    if (!row.id) {
      setDynamicDeductRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/payroll/${payroll.id}/items/${row.id}`, { method: "DELETE" });
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Gagal menghapus potongan.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Upload Slip
  const handleUploadSlip = async () => {
    if (!slipFile) {
      setError("Pilih file slip terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("slip", slipFile);
      const res = await fetch(`/api/payroll/${payroll.id}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengunggah slip.");
        return;
      }
      setSuccess("Slip gaji berhasil diunggah.");
      setSlipFile(null);
      onUpdated();
      await loadDetail(payroll.id);
    } catch {
      setError("Terjadi kesalahan saat mengunggah slip.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="payroll-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="payroll-modal-card payroll-edit-modal-card">
        {/* HEADER MODAL (Gambar 4 - 7) */}
        <div className="payroll-edit-modal-header">
          <div className="payroll-edit-modal-header-left">
            <h2 className="payroll-edit-modal-title">Edit Payroll {payroll.employeeName}</h2>
          </div>
          <div className="payroll-edit-modal-header-actions">
            <button
              type="button"
              className="payroll-btn-action-refresh"
              title="Perbarui data modal"
              onClick={() => loadDetail(payroll.id)}
              disabled={loading || saving}
            >
              <RotateCcw size={16} className={loading ? "spin" : ""} />
            </button>
            <button
              type="button"
              className={`payroll-btn-action-ubah ${isEditingGaji ? "active" : ""}`}
              onClick={handleToggleOrSaveGaji}
              disabled={loading || saving}
            >
              {saving && isEditingGaji ? (
                <Loader2 size={14} className="spin" />
              ) : isEditingGaji ? (
                "SIMPAN"
              ) : (
                "UBAH"
              )}
            </button>
            <button
              type="button"
              className="payroll-edit-modal-close"
              onClick={onClose}
              disabled={saving}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TABS (Gambar 4 - 7) */}
        <div className="payroll-edit-modal-tabs">
          <button
            type="button"
            className={`payroll-edit-tab-btn ${activeTab === "gaji" ? "active" : ""}`}
            onClick={() => setActiveTab("gaji")}
          >
            Gaji
          </button>
          <button
            type="button"
            className={`payroll-edit-tab-btn ${activeTab === "kompensasi" ? "active" : ""}`}
            onClick={() => setActiveTab("kompensasi")}
          >
            Kompensasi
          </button>
          <button
            type="button"
            className={`payroll-edit-tab-btn ${activeTab === "potongan" ? "active" : ""}`}
            onClick={() => setActiveTab("potongan")}
          >
            Potongan
          </button>
          <button
            type="button"
            className={`payroll-edit-tab-btn ${activeTab === "slip" ? "active" : ""}`}
            onClick={() => setActiveTab("slip")}
          >
            Unggah Slip
          </button>
        </div>

        {error && (
          <div className="payroll-modal-error">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="payroll-modal-success">
            <span>{success}</span>
          </div>
        )}

        {/* TAB CONTENTS */}
        <div className="payroll-edit-body">
          {/* TAB 1: GAJI (Gambar 5) */}
          {activeTab === "gaji" && (
            <div className="payroll-edit-tab-gaji">
              <h3 className="payroll-edit-subheading">Detail Gaji</h3>

              {isEditingGaji ? (
                <div className="payroll-edit-gaji-form">
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Type Gaji</label>
                    <select
                      className="payroll-form-select"
                      value={editSalaryType}
                      onChange={(e) => setEditSalaryType(e.target.value)}
                    >
                      <option value="bulan">bulan</option>
                      <option value="hari">hari</option>
                      <option value="jam">jam</option>
                    </select>
                  </div>
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Nominal Gaji</label>
                    <input
                      type="number"
                      className="payroll-form-input"
                      value={editRate}
                      onChange={(e) => setEditRate(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Jumlah Gaji</label>
                    <input
                      type="number"
                      step="0.01"
                      className="payroll-form-input"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Total Gaji</label>
                    <input
                      type="text"
                      className="payroll-form-input readonly"
                      readOnly
                      disabled
                      value={formatRupiah(Math.round(editRate * editQuantity))}
                    />
                  </div>
                </div>
              ) : (
                <div className="payroll-edit-gaji-grid">
                  <div className="payroll-edit-gaji-item">
                    <span className="payroll-edit-gaji-label">Type Gaji</span>
                    <strong className="payroll-edit-gaji-value">{editSalaryType}</strong>
                  </div>
                  <div className="payroll-edit-gaji-item">
                    <span className="payroll-edit-gaji-label">Nominal Gaji</span>
                    <strong className="payroll-edit-gaji-value">{formatRupiah(editRate)}</strong>
                  </div>
                  <div className="payroll-edit-gaji-item">
                    <span className="payroll-edit-gaji-label">Jumlah Gaji</span>
                    <strong className="payroll-edit-gaji-value">{editQuantity}</strong>
                  </div>
                  <div className="payroll-edit-gaji-item">
                    <span className="payroll-edit-gaji-label">Total Gaji</span>
                    <strong className="payroll-edit-gaji-value text-blue">
                      {formatRupiah(Math.round(editRate * editQuantity))}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KOMPENSASI (Gambar 6) */}
          {activeTab === "kompensasi" && (
            <div className="payroll-edit-tab-kompensasi">
              <h3 className="payroll-edit-subheading">Daftar Kompensasi</h3>

              <div className="payroll-edit-table-wrap">
                <table className="payroll-edit-table">
                  <thead>
                    <tr>
                      <th style={{ width: "26%" }}>Nama Kompensasi</th>
                      <th style={{ width: "20%" }}>Kompensasi Nominal</th>
                      <th style={{ width: "16%" }}>Kompensasi Qty</th>
                      <th style={{ width: "24%" }}>Kompensasi Total</th>
                      <th style={{ width: "14%", textAlign: "center" }}>Save</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1 Default: Klaim Beban */}
                    <tr>
                      <td>
                        <div className="payroll-item-static-name">Klaim Beban</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="payroll-item-input"
                          value={klaimBebanNominal}
                          onChange={(e) => setKlaimBebanNominal(Number(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="payroll-item-input"
                          value={klaimBebanQty}
                          onChange={(e) => setKlaimBebanQty(Number(e.target.value) || 0)}
                          placeholder="1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="payroll-item-input readonly"
                          readOnly
                          disabled
                          value={formatRupiah(Math.round(klaimBebanNominal * klaimBebanQty))}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="payroll-btn-item-save"
                          title="Simpan Klaim Beban"
                          onClick={handleSaveKlaimBeban}
                          disabled={saving}
                        >
                          <Save size={16} />
                        </button>
                      </td>
                    </tr>

                    {/* Dynamic Rows */}
                    {dynamicCompRows.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          {row.id ? (
                            <div className="payroll-item-static-name">{row.name}</div>
                          ) : (
                            <select
                              className="payroll-item-select"
                              value={row.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDynamicCompRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, name: val } : r)),
                                );
                              }}
                            >
                              <option value="">- Nama kompen -</option>
                              {compensationTerms.map((t) => (
                                <option key={t.id} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="payroll-item-input"
                            value={row.rate}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setDynamicCompRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, rate: val } : r)),
                              );
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="payroll-item-input"
                            value={row.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setDynamicCompRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)),
                              );
                            }}
                            placeholder="1"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="payroll-item-input readonly"
                            readOnly
                            disabled
                            value={formatRupiah(Math.round(row.rate * row.quantity))}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="payroll-item-action-btns">
                            <button
                              type="button"
                              className="payroll-btn-item-save"
                              title="Simpan"
                              onClick={() => handleSaveDynamicComp(idx)}
                              disabled={saving}
                            >
                              <Save size={15} />
                            </button>
                            <button
                              type="button"
                              className="payroll-btn-item-delete"
                              title="Hapus"
                              onClick={() => handleDeleteCompRow(idx)}
                              disabled={saving}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tombol Biru + Tambah Baris */}
              <div className="payroll-edit-add-row-wrap">
                <button
                  type="button"
                  className="payroll-btn-add-item-row"
                  title="Tambah baris kompensasi"
                  onClick={handleAddCompRow}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: POTONGAN (Gambar 7) */}
          {activeTab === "potongan" && (
            <div className="payroll-edit-tab-potongan">
              <h3 className="payroll-edit-subheading">Form Input Potongan</h3>

              {/* Alert Banner Oranye (Gambar 7) */}
              <div className="payroll-edit-alert-card">
                <div className="payroll-edit-alert-left">
                  <Info size={18} className="payroll-edit-alert-icon" />
                  <span>Silahkan lengkapi detail potongan</span>
                </div>
                <button
                  type="button"
                  className="payroll-edit-alert-btn"
                  onClick={() => {
                    if (kasbonNominal === 0) setKasbonNominal(100000);
                  }}
                >
                  Lengkapi Sekarang
                </button>
              </div>

              <div className="payroll-edit-table-wrap">
                <table className="payroll-edit-table">
                  <thead>
                    <tr>
                      <th style={{ width: "22%" }}>Nama Potongan</th>
                      <th style={{ width: "18%" }}>Potongan Nominal</th>
                      <th style={{ width: "14%" }}>Potongan Qty</th>
                      <th style={{ width: "18%" }}>Potongan Type</th>
                      <th style={{ width: "18%" }}>Total Potongan</th>
                      <th style={{ width: "10%", textAlign: "center" }}>Option</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1 Default: Kasbon */}
                    <tr>
                      <td>
                        <div className="payroll-item-static-name">Kasbon</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="payroll-item-input"
                          value={kasbonNominal}
                          onChange={(e) => setKasbonNominal(Number(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="payroll-item-input"
                          value={kasbonQty}
                          onChange={(e) => setKasbonQty(Number(e.target.value) || 0)}
                          placeholder="1"
                        />
                      </td>
                      <td>
                        <div className="payroll-item-static-name">{kasbonType}</div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="payroll-item-input readonly"
                          readOnly
                          disabled
                          value={formatRupiah(Math.round(kasbonNominal * kasbonQty))}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="payroll-btn-item-save"
                          title="Simpan Kasbon"
                          onClick={handleSaveKasbon}
                          disabled={saving}
                        >
                          <Save size={16} />
                        </button>
                      </td>
                    </tr>

                    {/* Dynamic Rows */}
                    {dynamicDeductRows.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          {row.id ? (
                            <div className="payroll-item-static-name">{row.name}</div>
                          ) : (
                            <select
                              className="payroll-item-select"
                              value={row.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDynamicDeductRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, name: val } : r)),
                                );
                              }}
                            >
                              <option value="">- Nama Po -</option>
                              {deductionTerms.map((t) => (
                                <option key={t.id} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="payroll-item-input"
                            value={row.rate}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setDynamicDeductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, rate: val } : r)),
                              );
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="payroll-item-input"
                            value={row.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setDynamicDeductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)),
                              );
                            }}
                            placeholder="1"
                          />
                        </td>
                        <td>
                          <select
                            className="payroll-item-select"
                            value={row.salaryType}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDynamicDeductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, salaryType: val } : r)),
                              );
                            }}
                          >
                            <option value="bulan">bulan</option>
                            <option value="hari">hari</option>
                            <option value="jam">jam</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="payroll-item-input readonly"
                            readOnly
                            disabled
                            value={formatRupiah(Math.round(row.rate * row.quantity))}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="payroll-item-action-btns">
                            <button
                              type="button"
                              className="payroll-btn-item-save"
                              title="Simpan"
                              onClick={() => handleSaveDynamicDeduct(idx)}
                              disabled={saving}
                            >
                              <Save size={15} />
                            </button>
                            <button
                              type="button"
                              className="payroll-btn-item-delete"
                              title="Hapus"
                              onClick={() => handleDeleteDeductRow(idx)}
                              disabled={saving}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tombol Biru + Tambah Baris */}
              <div className="payroll-edit-add-row-wrap">
                <button
                  type="button"
                  className="payroll-btn-add-item-row"
                  title="Tambah baris potongan"
                  onClick={handleAddDeductRow}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: UNGGAH SLIP (Gambar 4) */}
          {activeTab === "slip" && (
            <div className="payroll-edit-tab-slip">
              <h3 className="payroll-edit-subheading">Unggah Slip</h3>

              <div className="payroll-edit-upload-box">
                <label htmlFor={fileInputId} className="payroll-edit-upload-label">
                  <div className="payroll-edit-upload-icon-circle">
                    <CloudUpload size={32} />
                  </div>
                  <strong className="payroll-edit-upload-title">Pilih dokumen atau foto</strong>
                  <span className="payroll-edit-upload-subtext">PDF, JPG, PNG</span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="payroll-file-input-hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSlipFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                {slipFile && (
                  <div className="payroll-edit-selected-file">
                    <FileText size={18} className="text-blue-600" />
                    <span>
                      {slipFile.name} ({(slipFile.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSlipFile(null)}
                      className="payroll-edit-file-remove"
                      title="Hapus file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {existingSlipAssetId && !slipFile && (
                  <div className="payroll-edit-existing-file">
                    <FileText size={18} className="text-emerald-600" />
                    <span>Berkas tersimpan: {existingSlipName || "Slip Gaji"}</span>
                    <a
                      href={`/api/files/${existingSlipAssetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="payroll-edit-link-view"
                    >
                      Buka Dokumen
                    </a>
                  </div>
                )}

                <div className="payroll-edit-upload-btn-wrap">
                  <button
                    type="button"
                    className="payroll-btn-unggah-blue"
                    onClick={handleUploadSlip}
                    disabled={!slipFile || saving}
                  >
                    {saving ? <Loader2 size={14} className="spin" /> : null}
                    <span>UNGGAH</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER: Tombol merah TUTUP (Gambar 4 - 7) */}
        <div className="payroll-edit-modal-footer">
          <button type="button" className="payroll-btn-tutup-red" onClick={onClose} disabled={saving}>
            TUTUP
          </button>
        </div>
      </div>
    </div>
  );
}
