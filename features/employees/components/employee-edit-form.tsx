"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, LoaderCircle, Save, Settings, UploadCloud, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateEmployeeAction } from "@/features/workforce/server/actions";
import { useEmployeeSave } from "@/features/employees/components/use-employee-save";
import { setEmployeePassword, type EmployeePasswordState } from "@/features/employees/server/password-actions";
import { AttendanceLocationPicker, type LocationOption } from "@/features/employees/components/attendance-location-picker";

type Option = { id: string; name: string };
type Employee = { id: string; name: string; employeeCode: string; email: string; phone: string | null; address: string | null; taxNumber: string | null; socialSecurityNumber: string | null; birthDate: string | null; joinedAt: string; gender: "male" | "female" | "unspecified"; department: string; position: string; contractType: string | null; allAttendanceLocations: boolean; status: "active" | "inactive" };
type Documents = Partial<Record<"profile_photo" | "selfie" | "identity_card" | "certificate", string>>;
export type EmployeeAccountState = "active" | "pending" | "expired" | "none";
type Tab = "detail" | "password";

export function EmployeeEditForm({ employee, divisions, positions, documents, locations, selectedLocationIds, account, initialTab = "detail" }: {
  employee: Employee; divisions: Option[]; positions: Option[]; documents: Documents;
  locations: LocationOption[]; selectedLocationIds: string[]; account: EmployeeAccountState; initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return <div className="employee-create-card employee-edit-card">
    <div className="employee-create-head"><h2>Edit Karyawan</h2></div>
    <div className="employee-edit-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "detail"} className={tab === "detail" ? "is-active" : ""} onClick={() => setTab("detail")}><UserRound size={15}/> Detail Karyawan</button>
      <button type="button" role="tab" aria-selected={tab === "password"} className={tab === "password" ? "is-active" : ""} onClick={() => setTab("password")}><Settings size={15}/> Ganti Password</button>
    </div>
    {/* Both panels stay mounted so unsaved detail edits survive switching tabs. */}
    <div hidden={tab !== "detail"}><DetailForm employee={employee} divisions={divisions} positions={positions} documents={documents} locations={locations} selectedLocationIds={selectedLocationIds}/></div>
    <div hidden={tab !== "password"}><PasswordPanel employee={employee} account={account}/></div>
  </div>;
}

function DetailForm({ employee, divisions, positions, documents, locations, selectedLocationIds }: { employee: Employee; divisions: Option[]; positions: Option[]; documents: Documents; locations: LocationOption[]; selectedLocationIds: string[] }) {
  const { error, pending, onSubmit, errorRef } = useEmployeeSave(updateEmployeeAction);
  return <form onSubmit={onSubmit} className="employee-edit-detail">
    <input type="hidden" name="id" value={employee.id}/>
    {error && <div ref={errorRef} className="announcement-inline-error employee-form-error" role="alert">{error}</div>}
    <div className="employee-upload-grid">
      <UploadField name="profilePhoto" label="Upload foto karyawan" existing={documents.profile_photo}/>
      <UploadField name="selfiePhoto" label="Upload foto selfie karyawan" existing={documents.selfie}/>
      <UploadField name="identityCard" label="Upload foto KTP karyawan" existing={documents.identity_card}/>
      <UploadField name="certificate" label="Upload foto ijazah dan sertifikat" existing={documents.certificate} accept="image/jpeg,image/png,image/webp,application/pdf"/>
    </div>
    <div className="employee-form-columns"><div>
      <Field label="Nama Karyawan"><input name="name" defaultValue={employee.name} required/></Field>
      <Field label="Nomor Induk Karyawan"><input name="employeeCode" defaultValue={employee.employeeCode} required/></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={employee.email} required/></Field>
      <Field label="No. Handphone"><input name="phone" type="tel" defaultValue={employee.phone ?? ""}/></Field>
      <Field label="Alamat"><textarea name="address" defaultValue={employee.address ?? ""}/></Field>
      <Field label="Nomor Pokok Wajib Pajak (Opsional)"><input name="taxNumber" defaultValue={employee.taxNumber ?? ""}/></Field>
      <Field label="No. BPJS (Opsional)"><input name="socialSecurityNumber" defaultValue={employee.socialSecurityNumber ?? ""}/></Field>
    </div><div>
      <Field label="Tanggal Lahir"><input name="birthDate" type="date" defaultValue={employee.birthDate ?? ""}/></Field>
      <fieldset className="employee-gender"><legend>Jenis Kelamin Karyawan</legend><label><input type="radio" name="gender" value="male" defaultChecked={employee.gender === "male"}/> Laki-Laki</label><label><input type="radio" name="gender" value="female" defaultChecked={employee.gender === "female"}/> Perempuan</label><label><input type="radio" name="gender" value="unspecified" defaultChecked={employee.gender === "unspecified"}/> Belum ditentukan</label></fieldset>
      <fieldset className="employee-gender"><legend>Status</legend><label><input type="radio" name="status" value="active" defaultChecked={employee.status === "active"}/> Aktif</label><label><input type="radio" name="status" value="inactive" defaultChecked={employee.status === "inactive"}/> Nonaktif</label></fieldset>
      <Field label="Tanggal Mulai Kerja Karyawan"><input name="joinedAt" type="date" defaultValue={employee.joinedAt} required/></Field>
      <Field label="Divisi Karyawan"><select name="department" defaultValue={employee.department} required>{!divisions.some((x) => x.name === employee.department) && <option value={employee.department}>{employee.department}</option>}{divisions.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Jabatan Karyawan"><select name="position" defaultValue={employee.position} required>{!positions.some((x) => x.name === employee.position) && <option value={employee.position}>{employee.position}</option>}{positions.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Tipe Kontrak"><select name="contractType" defaultValue={employee.contractType ?? ""}><option value="">Pilih tipe kontrak</option><option value="Tetap">Tetap</option><option value="Kontrak">Kontrak</option><option value="Magang">Magang</option><option value="Harian Lepas">Harian Lepas</option></select></Field>
      <AttendanceLocationPicker locations={locations} defaultAll={employee.allAttendanceLocations} defaultSelected={selectedLocationIds}/>
    </div></div>
    <div className="employee-edit-actions"><Link className="btn btn-outline" href="/dashboard/karyawan">Batalkan</Link><SubmitButton pendingLabel="Menyimpan..." pending={pending}><Save size={15}/> Simpan</SubmitButton></div>
  </form>;
}

function PasswordPanel({ employee, account }: { employee: Employee; account: EmployeeAccountState }) {
  const [state, action, pending] = useActionState<EmployeePasswordState, FormData>(setEmployeePassword, { status: "idle" });
  const [show, setShow] = useState(false);

  if (account === "none") return <div className="employee-password-panel">
    <div className="employee-password-empty"><KeyRound size={22}/><div><strong>Karyawan ini belum punya akun login</strong><p>Buat akun dan kirim undangan dari halaman detail karyawan. Setelah itu password bisa diganti di sini.</p><Link className="btn btn-outline btn-sm" href={`/dashboard/karyawan/${employee.id}`}>Ke detail karyawan</Link></div></div>
  </div>;

  return <form action={action} className="employee-password-panel">
    <input type="hidden" name="employeeId" value={employee.id}/>
    <input type="email" name="username" autoComplete="username" value={employee.email} readOnly hidden/>
    <div className="employee-password-intro">
      <KeyRound size={20}/>
      <div><strong>Atur password baru untuk {employee.name}</strong><p>Akun login: <b>{employee.email}</b>{account !== "active" && " · undangan belum dipakai (tautan undangan akan ditutup)"}. Setelah disimpan, karyawan keluar dari semua perangkat dan menerima email pemberitahuan. Berikan password baru ini langsung kepada karyawan.</p></div>
    </div>
    {state.status === "error" && <div className="error-box" role="alert">{state.message}</div>}
    {state.status === "success" && <div className="success-box" role="status">{state.message}</div>}
    <div className="employee-password-fields">
      <Field label="Password Baru"><div className="employee-password-input"><input name="password" type={show ? "text" : "password"} minLength={8} maxLength={128} autoComplete="new-password" placeholder="Minimal 8 karakter" required/><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></Field>
      <Field label="Konfirmasi Password Baru"><input name="confirmation" type={show ? "text" : "password"} minLength={8} maxLength={128} autoComplete="new-password" placeholder="Ulangi password baru" required/></Field>
    </div>
    <div className="employee-edit-actions"><button className="btn btn-primary" disabled={pending}>{pending ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>} {pending ? "Menyimpan..." : "Simpan Password"}</button></div>
  </form>;
}

function UploadField({ name, label, existing, accept = "image/jpeg,image/png,image/webp" }: { name: string; label: string; existing?: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null); const [fileName, setFileName] = useState("");
  return <div className="employee-upload"><input ref={ref} type="file" name={name} accept={accept} hidden onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}/><button type="button" onClick={() => ref.current?.click()}><UploadCloud size={25}/><span>{fileName || (existing ? "Dokumen tersimpan — pilih untuk mengganti" : label)}</span><b>Cari Gambar</b></button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="employee-field"><span>{label}</span>{children}</label>; }
