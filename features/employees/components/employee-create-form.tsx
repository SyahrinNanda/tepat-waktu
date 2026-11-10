"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Save, UploadCloud } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { createEmployeeAction } from "@/features/workforce/server/actions";
import { useEmployeeSave } from "@/features/employees/components/use-employee-save";
import { AttendanceLocationPicker, type LocationOption } from "@/features/employees/components/attendance-location-picker";

type Option = { id: string; name: string };
export function EmployeeCreateForm({ divisions, positions, locations, today, disabled = false }: { divisions: Option[]; positions: Option[]; locations: LocationOption[]; today: string; disabled?: boolean }) {
  const { error, pending, onSubmit, errorRef } = useEmployeeSave(createEmployeeAction);
  return <form onSubmit={onSubmit} className="employee-create-card">
    <div className="employee-create-head"><h2>Detail Karyawan</h2><div><Link className="btn btn-outline" href="/dashboard/karyawan">Batalkan</Link>{disabled ? <button className="btn btn-primary" type="button" disabled title="Batas karyawan paket tercapai"><Save size={15}/> Simpan</button> : <SubmitButton pendingLabel="Menyimpan..." pending={pending}><Save size={15}/> Simpan</SubmitButton>}</div></div>
    {error && <div ref={errorRef} className="announcement-inline-error employee-form-error" role="alert">{error}</div>}
    <div className="employee-upload-grid"><UploadField name="profilePhoto" label="Upload foto karyawan"/><UploadField name="selfiePhoto" label="Upload foto selfie karyawan"/><UploadField name="identityCard" label="Upload foto KTP karyawan"/><UploadField name="certificate" label="Upload foto ijazah dan sertifikat" accept="image/jpeg,image/png,image/webp,application/pdf"/></div>
    <div className="employee-form-columns"><div>
      <Field label="Nama Karyawan"><input name="name" placeholder="Nama Karyawan..." required/></Field>
      <Field label="Nomor Induk Karyawan (Opsional)"><input name="employeeCode" placeholder="Nomor Induk Karyawan..."/></Field>
      <Field label="Email"><input name="email" type="email" placeholder="Email Karyawan..." required/></Field>
      <label className="employee-account-choice">
        <input name="createAccount" type="checkbox" defaultChecked/>
        <span><strong>Buat akun login &amp; kirim undangan email</strong><small>Karyawan menerima email untuk membuat password sendiri (berlaku 7 hari), lalu bisa absen dari HP. Matikan jika karyawan tidak perlu login.</small></span>
      </label>
      <Field label="No. Handphone"><input name="phone" type="tel" placeholder="No. HP Karyawan..."/></Field>
      <Field label="Alamat"><textarea name="address" placeholder="Alamat Karyawan..."/></Field>
      <Field label="Nomor Pokok Wajib Pajak (Opsional)"><input name="taxNumber" placeholder="Nomor Pokok Wajib Pajak..."/></Field>
      <Field label="No. BPJS (Opsional)"><input name="socialSecurityNumber" placeholder="No. BPJS..."/></Field>
    </div><div>
      <Field label="Tanggal Lahir"><input name="birthDate" type="date"/></Field>
      <fieldset className="employee-gender"><legend>Jenis Kelamin Karyawan</legend><label><input type="radio" name="gender" value="male" defaultChecked/> Laki-Laki</label><label><input type="radio" name="gender" value="female"/> Perempuan</label></fieldset>
      <Field label="Tanggal Mulai Kerja Karyawan"><input name="joinedAt" type="date" defaultValue={today} required/></Field>
      <Field label="Divisi Karyawan"><select name="department" defaultValue="" required><option value="" disabled>Pilih Divisi</option>{divisions.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Jabatan Karyawan"><select name="position" defaultValue="" required><option value="" disabled>Pilih Jabatan</option>{positions.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Tipe Kontrak"><select name="contractType" defaultValue=""><option value="">Pilih tipe kontrak</option><option value="Tetap">Tetap</option><option value="Kontrak">Kontrak</option><option value="Magang">Magang</option><option value="Harian Lepas">Harian Lepas</option></select></Field>
      <AttendanceLocationPicker locations={locations}/>
    </div></div>
  </form>;
}

function UploadField({ name, label, accept = "image/jpeg,image/png,image/webp" }: { name: string; label: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null); const [fileName, setFileName] = useState("");
  return <div className="employee-upload"><input ref={ref} type="file" name={name} accept={accept} hidden onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}/><button type="button" onClick={() => ref.current?.click()}><UploadCloud size={25}/><span>{fileName || label}</span><b>Cari Gambar</b></button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="employee-field"><span>{label}</span>{children}</label>; }
