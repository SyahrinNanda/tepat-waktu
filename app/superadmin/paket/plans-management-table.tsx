"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, RotateCcw, Search, Tags, Trash2, X } from "lucide-react";
import { createPlan, deletePlan, updatePlan } from "./actions";

export type PlanItem = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  maxEmployees: number;
  trialDays: number;
  description: string;
  active: boolean;
  createdAt: Date;
};

export function PlansManagementTable({ plans }: { plans: PlanItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanItem | null>(null);
  const [deletePlanItem, setDeletePlanItem] = useState<PlanItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? p.active : !p.active;

      return matchSearch && matchStatus;
    });
  }, [plans, search, statusFilter]);

  function formatRupiah(amount: number) {
    if (amount === 0) return "Gratis";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await createPlan(form);
      setNotice({ type: "success", text: "Paket baru berhasil ditambahkan." });
      setCreateOpen(false);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal menambahkan paket." });
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await updatePlan(form);
      setNotice({ type: "success", text: "Perubahan paket berhasil disimpan." });
      setEditPlan(null);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal memperbarui paket." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await deletePlan(form);
      setNotice({ type: "success", text: "Paket berhasil dihapus / dinonaktifkan." });
      setDeletePlanItem(null);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal menghapus paket." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {notice ? (
        <div className={notice.type === "success" ? "success-box" : "error-box"} role="alert">
          {notice.text}
        </div>
      ) : null}

      <div className="module-toolbar">
        <label className="search-control">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, atau deskripsi paket..."
          />
        </label>
        <select
          className="input compact-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", minWidth: "140px" }}
        >
          <option value="all">Semua Status</option>
          <option value="active">Paket Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        {(search || statusFilter !== "all") ? (
          <button
            type="button"
            className="btn btn-outline btn-compact"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
          >
            <RotateCcw size={14} /> Atur Ulang
          </button>
        ) : null}
        <div className="toolbar-spacer" />
        <button className="btn btn-primary btn-compact" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Tambah Paket Baru
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Paket</th>
              <th>Harga Bulanan</th>
              <th>Kapasitas</th>
              <th>Deskripsi</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong style={{ fontFamily: "monospace", fontSize: "12.5px", color: "var(--primary)" }}>
                    {plan.code.toUpperCase()}
                  </strong>
                </td>
                <td>
                  <strong>{plan.name}</strong>
                </td>
                <td>
                  <span style={{ fontWeight: 600 }}>{formatRupiah(plan.monthlyPrice)}</span>
                  {plan.monthlyPrice > 0 ? <small style={{ color: "var(--muted)" }}> / bln</small> : null}
                  {plan.monthlyPrice > 0 ? <small style={{ display: "block", color: "var(--muted)" }}>{formatRupiah(Math.round(plan.monthlyPrice / Math.max(plan.maxEmployees, 1)))} / karyawan</small> : plan.trialDays > 0 ? <small style={{ display: "block", color: "var(--muted)" }}>Trial {plan.trialDays} hari</small> : null}
                </td>
                <td>
                  <span className="badge blue">{plan.maxEmployees.toLocaleString("id-ID")} Karyawan</span>
                </td>
                <td style={{ maxWidth: "260px" }}>
                  <span style={{ color: "var(--muted)", fontSize: "12.5px" }}>{plan.description}</span>
                </td>
                <td>
                  {plan.active ? (
                    <span className="status-pill green">Aktif</span>
                  ) : (
                    <span className="status-pill" style={{ background: "#f6f5f4", color: "#7c7873" }}>
                      Nonaktif
                    </span>
                  )}
                </td>
                <td>
                  <div className="inline-actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-sm btn-outline"
                      title="Edit Paket"
                      onClick={() => setEditPlan(plan)}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      title="Hapus / Nonaktifkan"
                      onClick={() => setDeletePlanItem(plan)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPlans.length === 0 ? (
          <div className="empty-state">
            <Tags size={30} />
            <strong>Tidak ada paket yang sesuai</strong>
            <span>Coba ubah kata kunci pencarian atau tambah paket baru.</span>
          </div>
        ) : null}
      </div>

      <div className="table-footer">
        <span>Menampilkan {filteredPlans.length} dari {plans.length} paket langganan</span>
      </div>

      {/* Modal Tambah Paket Baru */}
      {createOpen ? (
        <div className="standard-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="standard-modal-card" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div>
                <h2>Tambah Paket Langganan Baru</h2>
                <p>Buat tingkatan paket baru untuk ditawarkan kepada perusahaan.</p>
              </div>
              <button className="icon-button" onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleCreate}>
              <div className="standard-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="field">
                    <span className="field-label">Kode Paket (Slug Unik)</span>
                    <input
                      className="input"
                      name="code"
                      placeholder="contoh: business-pro"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Nama Paket</span>
                    <input
                      className="input"
                      name="name"
                      placeholder="contoh: Business Pro"
                      required
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="field">
                    <span className="field-label">Harga Bulanan (Rp)</span>
                    <input
                      className="input"
                      name="monthlyPrice"
                      type="number"
                      min="0"
                      placeholder="0 untuk paket gratis"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Maksimal Karyawan</span>
                    <input
                      className="input"
                      name="maxEmployees"
                      type="number"
                      min="1"
                      defaultValue="25"
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Masa Trial Gratis (hari)</span>
                  <input className="input" name="trialDays" type="number" min="0" max="365" defaultValue="0" />
                </label>

                <label className="field">
                  <span className="field-label">Deskripsi Paket</span>
                  <input
                    className="input"
                    name="description"
                    placeholder="contoh: Akses seluruh fitur untuk skala berkembang"
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Status Penjualan</span>
                  <select className="input" name="active" defaultValue="true">
                    <option value="true">Aktif (Dapat dipilih pengguna)</option>
                    <option value="false">Nonaktif (Disembunyikan dari pendaftaran)</option>
                  </select>
                </label>
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Paket"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Edit Paket */}
      {editPlan ? (
        <div className="standard-modal-overlay" onClick={() => setEditPlan(null)}>
          <div className="standard-modal-card" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div>
                <h2>Edit Paket: {editPlan.name}</h2>
                <p>Kode: {editPlan.code.toUpperCase()}</p>
              </div>
              <button className="icon-button" onClick={() => setEditPlan(null)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleEdit}>
              <div className="standard-modal-body">
                <input type="hidden" name="id" value={editPlan.id} />
                <label className="field">
                  <span className="field-label">Nama Paket</span>
                  <input
                    className="input"
                    name="name"
                    defaultValue={editPlan.name}
                    required
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="field">
                    <span className="field-label">Harga Bulanan (Rp)</span>
                    <input
                      className="input"
                      name="monthlyPrice"
                      type="number"
                      min="0"
                      defaultValue={editPlan.monthlyPrice}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Maksimal Karyawan</span>
                    <input
                      className="input"
                      name="maxEmployees"
                      type="number"
                      min="1"
                      defaultValue={editPlan.maxEmployees}
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Masa Trial Gratis (hari)</span>
                  <input className="input" name="trialDays" type="number" min="0" max="365" defaultValue={editPlan.trialDays} />
                </label>

                <label className="field">
                  <span className="field-label">Deskripsi Paket</span>
                  <input
                    className="input"
                    name="description"
                    defaultValue={editPlan.description}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Status Penjualan</span>
                  <select className="input" name="active" defaultValue={String(editPlan.active)}>
                    <option value="true">Aktif (Dapat dipilih pengguna)</option>
                    <option value="false">Nonaktif (Disembunyikan)</option>
                  </select>
                </label>
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditPlan(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Konfirmasi Hapus Paket */}
      {deletePlanItem ? (
        <div className="standard-modal-overlay" onClick={() => setDeletePlanItem(null)}>
          <div className="standard-modal-card" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div>
                <h2>Hapus / Nonaktifkan Paket</h2>
                <p>{deletePlanItem.name} ({deletePlanItem.code})</p>
              </div>
              <button className="icon-button" onClick={() => setDeletePlanItem(null)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleDelete}>
              <div className="standard-modal-body">
                <input type="hidden" name="id" value={deletePlanItem.id} />
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.6", color: "#262421" }}>
                  Apakah Anda yakin ingin menghapus paket <strong>{deletePlanItem.name}</strong>? Jika paket ini pernah digunakan pada invoice langganan, paket akan otomatis dinonaktifkan agar data transaksi perusahaan tetap utuh.
                </p>
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setDeletePlanItem(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? "Memproses..." : "Ya, Hapus / Nonaktifkan"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

