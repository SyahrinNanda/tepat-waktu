"use client";

import { useMemo, useState } from "react";
import { KeyRound, RotateCcw, Search, Shield, ShieldAlert, Trash2, UserCheck, X } from "lucide-react";
import { deleteUserAccount, resetUserPassword, updateUserPlatformRole } from "./actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  platformRole: "user" | "superadmin";
  createdAt: Date;
  companyId: string | null;
  companyName: string | null;
  companyRole: string | null;
  employeePosition: string | null;
  employeeCode: string | null;
};

export function UserManagementTable({
  users,
  workspaces,
  currentUserId,
}: {
  users: UserRow[];
  workspaces: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [roleModalUser, setRoleModalUser] = useState<UserRow | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserRow | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.companyName && u.companyName.toLowerCase().includes(search.toLowerCase())) ||
        (u.companyRole && u.companyRole.toLowerCase().includes(search.toLowerCase()));

      const matchPlatform =
        platformFilter === "all" ? true : u.platformRole === platformFilter;

      const matchWorkspace =
        workspaceFilter === "all"
          ? true
          : workspaceFilter === "global"
            ? u.companyId === null
            : u.companyId === workspaceFilter;

      return matchSearch && matchPlatform && matchWorkspace;
    });
  }, [users, search, platformFilter, workspaceFilter]);

  async function handleRoleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!roleModalUser) return;
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await updateUserPlatformRole(form);
      setNotice({ type: "success", text: `Hak akses platform ${roleModalUser.name} berhasil diperbarui.` });
      setRoleModalUser(null);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal mengubah role." });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passwordModalUser) return;
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await resetUserPassword(form);
      setNotice({ type: "success", text: `Kata sandi untuk ${passwordModalUser.name} berhasil diubah.` });
      setPasswordModalUser(null);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal mereset kata sandi." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deleteModalUser) return;
    setLoading(true);
    setNotice(null);
    try {
      const form = new FormData(e.currentTarget);
      await deleteUserAccount(form);
      setNotice({ type: "success", text: `Akun ${deleteModalUser.name} berhasil dihapus.` });
      setDeleteModalUser(null);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal menghapus akun." });
    } finally {
      setLoading(false);
    }
  }

  function roleLabel(role: string | null) {
    if (!role) return "—";
    const map: Record<string, string> = {
      admin: "Admin",
      owner: "Admin",
      general_manager: "General Manager",
      hrd: "HRD",
      manager: "Manager",
      employee: "Karyawan / Staf",
    };
    return map[role] ?? role;
  }

  return (
    <div>
      {notice ? (
        <div className={notice.type === "success" ? "success-box" : "error-box"} role="alert">
          {notice.text}
        </div>
      ) : null}

      <div className="module-toolbar superadmin-users-toolbar">
        <div className="superadmin-users-filter-grid">
          <label className="superadmin-users-filter-field superadmin-users-search-field">
            <span>Cari Pengguna</span>
            <div className="search-control">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama, email, atau perusahaan..."
              />
            </div>
          </label>

          <label className="superadmin-users-filter-field">
            <span>Akses Platform</span>
            <select
              className="input superadmin-users-select"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="all">Semua Akses Platform</option>
              <option value="superadmin">Super Admin</option>
              <option value="user">User Biasa</option>
            </select>
          </label>

          <label className="superadmin-users-filter-field">
            <span>Ruang Kerja</span>
            <select
              className="input superadmin-users-select"
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value)}
            >
              <option value="all">Semua Ruang Kerja</option>
              <option value="global">Platform Global / Tanpa Ruang Kerja</option>
              {workspaces.map((workspace) => (
                <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
              ))}
            </select>
          </label>

          {(search || platformFilter !== "all" || workspaceFilter !== "all") ? (
            <button
              type="button"
              className="btn btn-outline btn-compact superadmin-users-reset"
              onClick={() => {
                setSearch("");
                setPlatformFilter("all");
                setWorkspaceFilter("all");
              }}
            >
              <RotateCcw size={14} /> Atur Ulang
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Akses Platform</th>
              <th>Ruang Kerja / Tenant</th>
              <th>Role Tenant</th>
              <th>Terdaftar</th>
              <th style={{ textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const initials = u.name.slice(0, 2).toUpperCase();
              const isSelf = u.id === currentUserId;
              return (
                <tr key={`${u.id}:${u.companyId ?? "global"}`}>
                  <td>
                    <div className="table-user">
                      <span
                        className="avatar"
                        style={{
                          background: u.platformRole === "superadmin" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : undefined,
                        }}
                      >
                        {initials}
                      </span>
                      <div>
                        <strong>
                          {u.name} {isSelf ? <span style={{ fontSize: "10px", color: "var(--primary)" }}>(Anda)</span> : null}
                        </strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {u.platformRole === "superadmin" ? (
                      <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                        <Shield size={12} style={{ marginRight: "4px" }} /> Super Admin
                      </span>
                    ) : (
                      <span className="badge gray">User</span>
                    )}
                  </td>
                  <td>
                    {u.companyName ? (
                      <div>
                        <strong>{u.companyName}</strong>
                        {u.employeeCode ? <small style={{ display: "block", color: "var(--muted)" }}>{u.employeeCode}</small> : null}
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Platform (Global)</span>
                    )}
                  </td>
                  <td>
                    {u.companyRole ? (
                      <span className={`status-pill ${["admin", "owner"].includes(u.companyRole) ? "blue" : "green"}`}>
                        {roleLabel(u.companyRole)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(u.createdAt))}
                  </td>
                  <td>
                    <div className="inline-actions" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-sm btn-outline"
                        title="Ubah Hak Akses Platform"
                        onClick={() => setRoleModalUser(u)}
                      >
                        <Shield size={14} /> Role
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        title="Atur Ulang Kata Sandi"
                        onClick={() => setPasswordModalUser(u)}
                      >
                        <KeyRound size={14} /> Password
                      </button>
                      {!isSelf ? (
                        <button
                          className="btn btn-sm btn-danger"
                          title="Hapus Akun Pengguna"
                          onClick={() => setDeleteModalUser(u)}
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
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <UserCheck size={32} />
            <strong>Tidak ada akun yang sesuai</strong>
            <span>Coba ubah kata kunci, akses platform, atau filter ruang kerja.</span>
          </div>
        ) : null}
      </div>

      <div className="table-footer">
        <span>Menampilkan {filteredUsers.length} dari {users.length} akun terdaftar</span>
      </div>

      {/* Modal Ubah Role Platform */}
      {roleModalUser ? (
        <div className="standard-modal-overlay" onClick={() => setRoleModalUser(null)}>
          <div className="standard-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div>
                <h2>Ubah Akses Platform</h2>
                <p>{roleModalUser.name} ({roleModalUser.email})</p>
              </div>
              <button className="icon-button" onClick={() => setRoleModalUser(null)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleRoleSubmit}>
              <div className="standard-modal-body">
                <input type="hidden" name="userId" value={roleModalUser.id} />
                <label className="field">
                  <span className="field-label">Tingkat Hak Akses Platform</span>
                  <select
                    className="input"
                    name="platformRole"
                    defaultValue={roleModalUser.platformRole}
                    disabled={roleModalUser.id === currentUserId}
                  >
                    <option value="user">User Biasa (Terikat hak akses tenant perusahaan)</option>
                    <option value="superadmin">Super Admin (Akses penuh ke seluruh konsol platform)</option>
                  </select>
                </label>
                {roleModalUser.id === currentUserId ? (
                  <p style={{ fontSize: "11px", color: "var(--red)", margin: 0 }}>
                    Anda tidak dapat mencabut hak akses Super Admin dari akun Anda sendiri.
                  </p>
                ) : (
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                    Super Admin dapat melihat dan mengelola seluruh tenant perusahaan, konfigurasi harga paket, dan data akun sistem.
                  </p>
                )}
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRoleModalUser(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || roleModalUser.id === currentUserId}>
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Reset Password */}
      {passwordModalUser ? (
        <div className="standard-modal-overlay" onClick={() => setPasswordModalUser(null)}>
          <div className="standard-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div>
                <h2>Atur Kata Sandi Baru</h2>
                <p>Akun: {passwordModalUser.email}</p>
              </div>
              <button className="icon-button" onClick={() => setPasswordModalUser(null)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handlePasswordSubmit}>
              <div className="standard-modal-body">
                <input type="hidden" name="userId" value={passwordModalUser.id} />
                <label className="field">
                  <span className="field-label">Kata Sandi Baru</span>
                  <input
                    className="input"
                    name="newPassword"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                    required
                  />
                </label>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                  Pengguna dapat langsung masuk menggunakan kata sandi baru ini. Pastikan memberi tahu pengguna secara aman.
                </p>
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setPasswordModalUser(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Perbarui Kata Sandi"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Konfirmasi Hapus Akun */}
      {deleteModalUser ? (
        <div className="standard-modal-overlay" onClick={() => setDeleteModalUser(null)}>
          <div className="standard-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <header className="standard-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="stat-icon red"><ShieldAlert size={18} /></span>
                <div>
                  <h2>Konfirmasi Hapus Akun</h2>
                  <p>{deleteModalUser.name}</p>
                </div>
              </div>
              <button className="icon-button" onClick={() => setDeleteModalUser(null)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleDeleteSubmit}>
              <div className="standard-modal-body">
                <input type="hidden" name="userId" value={deleteModalUser.id} />
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.6", color: "#1e293b" }}>
                  Apakah Anda yakin ingin menghapus akun <strong>{deleteModalUser.email}</strong>? Tindakan ini akan menghapus sesi login dan keanggotaan tenant pengguna secara permanen.
                </p>
              </div>
              <footer className="standard-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setDeleteModalUser(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? "Menghapus..." : "Ya, Hapus Akun"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

