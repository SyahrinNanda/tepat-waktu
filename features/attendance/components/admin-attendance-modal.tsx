/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClipboardCheck, LoaderCircle, Plus, X } from "lucide-react";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode?: string;
  department?: string;
  companyId: string;
};

export function AdminAttendanceModal({
  employees,
  defaultDate,
}: {
  employees: EmployeeOption[];
  defaultDate?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [checkInPreview, setCheckInPreview] = useState<string | null>(null);
  const [checkOutPreview, setCheckOutPreview] = useState<string | null>(null);

  const checkInInputRef = useRef<HTMLInputElement>(null);
  const checkOutInputRef = useRef<HTMLInputElement>(null);

  // Local calendar date (toISOString would give yesterday before 07:00 WIB).
  const todayStr = defaultDate || new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  function handleCheckInFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCheckInPreview(url);
    } else {
      setCheckInPreview(null);
    }
  }

  function handleCheckOutFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCheckOutPreview(url);
    } else {
      setCheckOutPreview(null);
    }
  }

  function clearCheckInPhoto() {
    setCheckInPreview(null);
    if (checkInInputRef.current) checkInInputRef.current.value = "";
  }

  function clearCheckOutPhoto() {
    setCheckOutPreview(null);
    if (checkOutInputRef.current) checkOutInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch("/api/attendance/admin", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan kehadiran.");
      }

      setNotice({ type: "success", text: data.message || "Kehadiran berhasil dicatat." });
      setTimeout(() => {
        setIsOpen(false);
        setCheckInPreview(null);
        setCheckOutPreview(null);
        setNotice(null);
        router.refresh();
      }, 1200);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
        <Plus size={16} /> Catat Kehadiran Karyawan
      </button>

      {isOpen ? (
        <div className="standard-modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="standard-modal-card"
            style={{ maxWidth: "680px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="standard-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="stat-icon green">
                  <ClipboardCheck size={20} />
                </span>
                <div>
                  <h2>Catat Kehadiran Karyawan</h2>
                  <p>Input kehadiran manual oleh Admin dengan lampiran foto masuk & pulang.</p>
                </div>
              </div>
              <button className="icon-button" onClick={() => setIsOpen(false)} aria-label="Tutup modal">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="standard-modal-body">
                {notice ? (
                  <div className={notice.type === "success" ? "success-box" : "error-box"} role="alert">
                    {notice.type === "success" ? <CheckCircle2 size={16} /> : null}
                    {notice.text}
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px" }}>
                  <label className="field">
                    <span className="field-label">Pilih Karyawan</span>
                    <select className="input" name="employeeId" required defaultValue="">
                      <option value="" disabled>
                        Pilih nama karyawan...
                      </option>
                      {employees.map((emp) => (
                        <option value={emp.id} key={emp.id}>
                          {emp.name} {emp.department ? `(${emp.department})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">Tanggal Kehadiran</span>
                    <input
                      className="input"
                      name="attendanceDate"
                      type="date"
                      defaultValue={todayStr}
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Status Kehadiran</span>
                  <select className="input" name="status" defaultValue="present">
                    <option value="present">Hadir (Tepat Waktu)</option>
                    <option value="late">Terlambat</option>
                    <option value="leave">Izin / Cuti</option>
                    <option value="absent">Tidak Hadir (Alpa)</option>
                  </select>
                </label>

                {/* Sesi Kehadiran & Foto Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "4px" }}>
                  {/* Bagian Masuk (Check-In) */}
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      padding: "16px",
                      background: "#fbfbfb",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)", marginBottom: "12px" }}>
                      🟢 Sesi Masuk (Check-In)
                    </div>

                    <label className="field">
                      <span className="field-label">Jam Masuk</span>
                      <input
                        className="input"
                        name="checkInTime"
                        type="time"
                        defaultValue="08:00"
                      />
                    </label>

                    <span className="field-label">Foto Kamera / Bukti Masuk</span>
                    {checkInPreview ? (
                      <div className="photo-preview-wrap">
                        <img src={checkInPreview} alt="Preview Check-In" className="photo-preview-img" />
                        <button
                          type="button"
                          className="photo-remove-btn"
                          onClick={clearCheckInPhoto}
                          title="Hapus foto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="photo-upload-box">
                        <input
                          ref={checkInInputRef}
                          name="photoCheckIn"
                          type="file"
                          accept="image/*"
                          capture="user"
                          style={{ display: "none" }}
                          onChange={handleCheckInFileChange}
                        />
                        <Camera size={24} style={{ color: "var(--muted)", margin: "0 auto 6px" }} />
                        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
                          Upload Foto Check-In
                        </div>
                        <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                          JPG, PNG atau WebP (Maks. 5 MB)
                        </small>
                      </label>
                    )}
                  </div>

                  {/* Bagian Pulang (Check-Out) */}
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      padding: "16px",
                      background: "#fbfbfb",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)", marginBottom: "12px" }}>
                      🔴 Sesi Pulang (Check-Out)
                    </div>

                    <label className="field">
                      <span className="field-label">Jam Pulang</span>
                      <input
                        className="input"
                        name="checkOutTime"
                        type="time"
                        defaultValue="17:00"
                      />
                    </label>

                    <span className="field-label">Foto Kamera / Bukti Pulang</span>
                    {checkOutPreview ? (
                      <div className="photo-preview-wrap">
                        <img src={checkOutPreview} alt="Preview Check-Out" className="photo-preview-img" />
                        <button
                          type="button"
                          className="photo-remove-btn"
                          onClick={clearCheckOutPhoto}
                          title="Hapus foto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="photo-upload-box">
                        <input
                          ref={checkOutInputRef}
                          name="photoCheckOut"
                          type="file"
                          accept="image/*"
                          capture="user"
                          style={{ display: "none" }}
                          onChange={handleCheckOutFileChange}
                        />
                        <Camera size={24} style={{ color: "var(--muted)", margin: "0 auto 6px" }} />
                        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
                          Upload Foto Check-Out
                        </div>
                        <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                          JPG, PNG atau WebP (Maks. 5 MB)
                        </small>
                      </label>
                    )}
                  </div>
                </div>

                <label className="field" style={{ marginTop: "14px" }}>
                  <span className="field-label">Alasan / Catatan Audit Administrator</span>
                  <input
                    className="input"
                    name="note"
                    placeholder="Contoh: Pencatatan manual kehadiran offline / koreksi sistem"
                    defaultValue="Pencatatan manual kehadiran oleh Administrator"
                    required
                  />
                </label>
              </div>

              <footer className="standard-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <LoaderCircle className="spin" size={16} /> : <ClipboardCheck size={16} />}
                  {loading ? "Menyimpan Kehadiran..." : "Simpan Kehadiran"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

