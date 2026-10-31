"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Save, Settings, UploadCloud, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateEmployee } from "@/features/workforce/server/actions";

type Option = { id: string; name: string };
type Employee = { id: string; name: string; employeeCode: string; email: string; phone: string | null; address: string | null; taxNumber: string | null; socialSecurityNumber: string | null; birthDate: string | null; joinedAt: string; gender: "male" | "female" | "unspecified"; department: string; position: string; contractType: string | null; allAttendanceLocations: boolean; status: "active" | "inactive" };
type Documents = Partial<Record<"profile_photo" | "selfie" | "identity_card" | "certificate", string>>;

export function EmployeeEditForm({ employee, divisions, positions, documents }: { employee: Employee; divisions: Option[]; positions: Option[]; documents: Documents }) {
  return <form action={updateEmployee} className="employee-create-card employee-edit-card">
    <input type="hidden" name="id" value={employee.id}/>
    <div className="employee-create-head"><h2>Edit Karyawan</h2></div>
    <div className="employee-edit-tabs"><span><UserRound size={15}/> Detail Karyawan</span><button type="button" title="Perubahan password dilakukan melalui akun pengguna"><Settings size={15}/> Ganti Password</button></div>
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
      <fieldset className="employee-location-choice"><legend>Lokasi Absen Karyawan</legend><label><input name="allAttendanceLocations" type="checkbox" defaultChecked={employee.allAttendanceLocations}/> Semua Lokasi Perusahaan</label></fieldset>
    </div></div>
    <div className="employee-edit-actions"><Link className="btn btn-outline" href="/dashboard/karyawan">Batalkan</Link><SubmitButton pendingLabel="Menyimpan..."><Save size={15}/> Simpan</SubmitButton></div>
  </form>;
}

function UploadField({ name, label, existing, accept = "image/jpeg,image/png,image/webp" }: { name: string; label: string; existing?: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null); const [fileName, setFileName] = useState("");
  return <div className="employee-upload"><input ref={ref} type="file" name={name} accept={accept} hidden onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}/><button type="button" onClick={() => ref.current?.click()}><UploadCloud size={25}/><span>{fileName || (existing ? "Dokumen tersimpan — pilih untuk mengganti" : label)}</span><b>Cari Gambar</b></button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="employee-field"><span>{label}</span>{children}</label>; }
