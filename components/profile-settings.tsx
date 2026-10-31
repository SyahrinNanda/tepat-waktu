"use client";

import {
  CircleAlert,
  Eye,
  EyeOff,
  House,
  Pencil,
  RotateCcw,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  resetCompanyData,
  updateCompanyProfile,
  updateUserProfile,
  type ProfileMutationResult,
} from "@/app/dashboard/pengaturan/profile/actions";
import { authClient } from "@/lib/auth-client";

type UserProfile = {
  name: string;
  email: string;
  timezone: string;
  role: string;
};

type CompanyProfile = {
  name: string;
  email: string;
  industry: string;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  planName: string;
  employeeCount: number;
  maxEmployees: number;
};

type Tab = "user" | "company" | "password";
type Notice = { type: "success" | "error"; text: string } | null;

const timezoneOptions = [
  { value: "Asia/Jakarta", label: "WIB (Asia/Jakarta)" },
  { value: "Asia/Makassar", label: "WITA (Asia/Makassar)" },
  { value: "Asia/Jayapura", label: "WIT (Asia/Jayapura)" },
];

export function ProfileSettings({
  user,
  company,
  canManageCompany,
}: {
  user: UserProfile;
  company: CompanyProfile;
  canManageCompany: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("user");
  const [editingUser, setEditingUser] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState([false, false, false]);

  const usage = Math.min(100, Math.round(
    (company.employeeCount / Math.max(company.maxEmployees, 1)) * 100,
  ));

  function runMutation(
    mutation: () => Promise<ProfileMutationResult>,
    onSuccess?: () => void,
  ) {
    setNotice(null);
    startTransition(async () => {
      const result = await mutation();
      if (!result.ok) {
        setNotice({ type: "error", text: result.error ?? "Perubahan gagal disimpan." });
        return;
      }
      setNotice({ type: "success", text: result.message ?? "Perubahan berhasil disimpan." });
      onSuccess?.();
      router.refresh();
    });
  }

  function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    runMutation(
      () => updateUserProfile({
        name: String(values.get("name") ?? ""),
        email: String(values.get("email") ?? ""),
        timezone: String(values.get("timezone") ?? ""),
      }),
      () => setEditingUser(false),
    );
  }

  function submitCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    runMutation(
      () => updateCompanyProfile({
        name: String(values.get("name") ?? ""),
        email: String(values.get("email") ?? ""),
        industry: String(values.get("industry") ?? ""),
        province: String(values.get("province") ?? ""),
        city: String(values.get("city") ?? ""),
        district: String(values.get("district") ?? ""),
        address: String(values.get("address") ?? ""),
        phone: String(values.get("phone") ?? ""),
        whatsapp: String(values.get("whatsapp") ?? ""),
      }),
      () => setEditingCompany(false),
    );
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (newPassword.length < 8) {
      setNotice({ type: "error", text: "Password baru minimal 8 karakter." });
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setNotice({ type: "error", text: "Konfirmasi password baru tidak sama." });
      return;
    }
    startTransition(async () => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setNotice({ type: "error", text: result.error.message ?? "Password gagal diganti." });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setNotice({ type: "success", text: "Password berhasil diganti. Sesi lain telah dikeluarkan." });
    });
  }

  function confirmReset() {
    runMutation(
      () => resetCompanyData({ confirmation: resetConfirmation }),
      () => {
        setResetOpen(false);
        setResetConfirmation("");
      },
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <small>Presensi Admin Panel</small>
        <h1>PROFILE</h1>
        <nav aria-label="Breadcrumb">
          <a href="/dashboard">Beranda</a><span>/</span><span>Settings</span><span>/</span><span>Profile</span>
        </nav>
      </header>

      <div className="profile-reference-layout">
        <aside className="profile-company-summary">
          <div className="profile-company-logo" aria-label="Logo TepatWaktu">
            <span className="profile-brand-mark" aria-hidden="true" />
          </div>
          <h2>{company.name}</h2>
          <p>{company.email}</p>
          <div className="profile-company-status">
            <h3>Status Perusahaan</h3>
            <div className="profile-usage-line">
              <span>Karyawan</span>
              <span>{company.employeeCount} / {company.maxEmployees} ({usage}%)</span>
            </div>
            <div className="profile-usage-meter"><i style={{ width: `${usage}%` }} /></div>
            {canManageCompany ? (
              <button
                type="button"
                className="profile-reset-button"
                onClick={() => { setNotice(null); setResetOpen(true); }}
              >
                <RotateCcw size={14} /> RESET DATA PERUSAHAAN
              </button>
            ) : null}
          </div>
        </aside>

        <section className="profile-detail-card">
          <div className="profile-reference-tabs" role="tablist" aria-label="Pengaturan profile">
            <button type="button" role="tab" aria-selected={tab === "user"} className={tab === "user" ? "active" : ""} onClick={() => { setTab("user"); setNotice(null); }}><UserRound size={18} />Profile User</button>
            <button type="button" role="tab" aria-selected={tab === "company"} className={tab === "company" ? "active" : ""} onClick={() => { setTab("company"); setNotice(null); }}><House size={18} />Profile Perusahaan</button>
            <button type="button" role="tab" aria-selected={tab === "password"} className={tab === "password" ? "active" : ""} onClick={() => { setTab("password"); setNotice(null); }}><Settings size={18} />Reset Password</button>
          </div>

          {notice ? <div className={`profile-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</div> : null}

          {tab === "user" ? (
            <form className="profile-tab-content" onSubmit={submitUser}>
              <div className="profile-content-actions">
                {editingUser ? (
                  <div><button type="button" className="profile-secondary-button" onClick={() => setEditingUser(false)}>BATAL</button><button type="submit" className="profile-edit-button" disabled={pending}>SIMPAN PROFILE</button></div>
                ) : <button type="button" className="profile-edit-button" onClick={() => setEditingUser(true)}><Pencil size={14} /> EDIT PROFILE</button>}
              </div>
              {editingUser ? (
                <div className="profile-edit-grid">
                  <ProfileField label="Nama" name="name" defaultValue={user.name} required />
                  <ProfileField label="Email" name="email" type="email" defaultValue={user.email} required />
                  <label className="profile-edit-field"><span>Timezone</span><select name="timezone" defaultValue={user.timezone}>{timezoneOptions.map((zone) => <option value={zone.value} key={zone.value}>{zone.label}</option>)}</select></label>
                </div>
              ) : (
                <dl className="profile-value-list">
                  <ProfileValue label="Nama" value={user.name} />
                  <ProfileValue label="Email" value={user.email} />
                  <ProfileValue label="Timezone" value={timezoneLabel(user.timezone)} />
                </dl>
              )}
            </form>
          ) : null}

          {tab === "company" ? (
            <form className="profile-tab-content" onSubmit={submitCompany}>
              <div className="profile-content-actions">
                {editingCompany ? (
                  <div><button type="button" className="profile-secondary-button" onClick={() => setEditingCompany(false)}>BATAL</button><button type="submit" className="profile-edit-button" disabled={pending}>SIMPAN PROFILE</button></div>
                ) : canManageCompany ? <button type="button" className="profile-edit-button" onClick={() => setEditingCompany(true)}><Pencil size={14} /> EDIT PROFILE</button> : null}
              </div>
              {editingCompany ? (
                <div className="profile-edit-grid company">
                  <ProfileField label="Nama Perusahaan" name="name" defaultValue={company.name} required />
                  <ProfileField label="Email Perusahaan" name="email" type="email" defaultValue={company.email} />
                  <ProfileField label="Bidang Perusahaan" name="industry" defaultValue={company.industry} required />
                  <ProfileField label="Provinsi Perusahaan" name="province" defaultValue={company.province ?? ""} />
                  <ProfileField label="Kota Perusahaan" name="city" defaultValue={company.city ?? ""} />
                  <ProfileField label="Kecamatan Perusahaan" name="district" defaultValue={company.district ?? ""} />
                  <ProfileField label="Alamat Perusahaan" name="address" defaultValue={company.address ?? ""} />
                  <ProfileField label="No Telp. Perusahaan" name="phone" defaultValue={company.phone ?? ""} />
                  <ProfileField label="No WA Perusahaan" name="whatsapp" defaultValue={company.whatsapp ?? ""} />
                </div>
              ) : (
                <dl className="profile-value-list company">
                  <ProfileValue label="Nama Perusahaan" value={company.name} />
                  <ProfileValue label="Email Perusahaan" value={company.email} />
                  <ProfileValue label="Bidang Perusahaan" value={company.industry} />
                  <ProfileValue label="Provinsi Perusahaan" value={company.province} />
                  <ProfileValue label="Kota Perusahaan" value={company.city} />
                  <ProfileValue label="Kecamatan Perusahaan" value={company.district} />
                  <ProfileValue label="Alamat Perusahaan" value={company.address} />
                  <ProfileValue label="No Telp. Perusahaan" value={company.phone} />
                  <ProfileValue label="No WA Perusahaan" value={company.whatsapp} />
                </dl>
              )}
            </form>
          ) : null}

          {tab === "password" ? (
            <form className="profile-password-form" onSubmit={submitPassword}>
              <PasswordField label="Masukkan Password Lama" placeholder="Password Lama" value={currentPassword} onChange={setCurrentPassword} visible={passwordVisibility[0]} toggle={() => toggleVisibility(0, setPasswordVisibility)} autoComplete="current-password" />
              <PasswordField label="Masukkan Password Baru" placeholder="Password Baru" value={newPassword} onChange={setNewPassword} visible={passwordVisibility[1]} toggle={() => toggleVisibility(1, setPasswordVisibility)} autoComplete="new-password" />
              <PasswordField label="Konfirmasi Password Baru" placeholder="Konfirmasi Password Baru" value={passwordConfirmation} onChange={setPasswordConfirmation} visible={passwordVisibility[2]} toggle={() => toggleVisibility(2, setPasswordVisibility)} autoComplete="new-password" />
              <div className="profile-password-actions"><button type="submit" disabled={pending}>GANTI PASSWORD</button></div>
            </form>
          ) : null}
        </section>
      </div>

      {resetOpen ? (
        <div className="profile-reset-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false); }}>
          <section className="profile-reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-company-title">
            <button type="button" className="profile-modal-close" onClick={() => setResetOpen(false)} aria-label="Tutup"><X size={18} /></button>
            <div className="profile-warning-icon"><CircleAlert size={48} /></div>
            <h2 id="reset-company-title">Pemberitahuan!</h2>
            <p>Anda yakin ingin mereset data perusahaan?<br />Seluruh data perusahaan seperti Data Absensi, Data Karyawan, Data Kunjungan dan data penting lainnya akan dihapus selamanya.</p>
            <label><span>Ketik <strong>{company.name}</strong> untuk melanjutkan</span><input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} autoFocus /></label>
            <div className="profile-reset-actions"><button type="button" className="confirm" disabled={pending || resetConfirmation !== company.name} onClick={confirmReset}>Ya, Reset</button><button type="button" className="cancel" onClick={() => setResetOpen(false)}>Batal</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function ProfileField({ label, name, defaultValue, type = "text", required = false, disabled = false }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean; disabled?: boolean }) {
  return <label className="profile-edit-field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} disabled={disabled} maxLength={name === "address" ? 500 : 160} /></label>;
}

function PasswordField({ label, placeholder, value, onChange, visible, toggle, autoComplete }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; visible: boolean; toggle: () => void; autoComplete: string }) {
  return <label className="profile-password-field"><span>{label}</span><div><input type={visible ? "text" : "password"} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required minLength={8} /><button type="button" onClick={toggle} aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>;
}

function toggleVisibility(index: number, setter: React.Dispatch<React.SetStateAction<boolean[]>>) {
  setter((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value));
}

function timezoneLabel(value: string) {
  if (value === "Asia/Jakarta") return "WIB";
  if (value === "Asia/Makassar") return "WITA";
  if (value === "Asia/Jayapura") return "WIT";
  return value;
}
