import type { Metadata } from "next";
import Link from "next/link";
import { asc, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { createPayroll } from "./actions";

export const metadata: Metadata = { title: "Tambah Payroll" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "hrd", "general_manager"]);
  const team = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name));
  const now = new Date();
  return <><header className="product-page-header"><span className="breadcrumb">PAYROLL / TAMBAH</span><div><h1>Tambah Payroll</h1><p>Buat komponen payroll sebagai draft untuk karyawan dan periode tertentu.</p></div></header><section className="module-card subscription-checkout"><div className="card-heading-row"><h2>Salary Details</h2><Link className="btn btn-outline" href="/dashboard/payroll">Batalkan</Link></div><form action={createPayroll} className="form-grid"><label className="field"><span className="field-label">Bulan</span><select className="input" name="month" defaultValue={now.getMonth() + 1}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2026, index, 1))}</option>)}</select></label><label className="field"><span className="field-label">Tahun</span><input className="input" type="number" name="year" min="2020" max="2100" defaultValue={now.getFullYear()} required /></label><label className="field full"><span className="field-label">Karyawan</span><select className="input" name="employeeId" required><option value="">Pilih karyawan</option>{team.map((person) => <option key={person.id} value={person.id}>{person.employeeCode} — {person.name}</option>)}</select></label><label className="field"><span className="field-label">Tipe Gaji</span><select className="input" name="type"><option>Pendapatan</option><option>Potongan</option></select></label><label className="field"><span className="field-label">Jumlah</span><input className="input" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></label><label className="field"><span className="field-label">Nominal per unit (Rp)</span><input className="input" name="nominal" type="number" min="0" step="1" required /></label><div className="full action-row"><button className="btn btn-primary" type="submit">Simpan Draft Payroll</button></div></form><p className="form-help">Setiap input adalah satu komponen draft. Perhitungan pajak, BPJS, dan slip gaji final belum otomatis tersedia.</p></section></>;
}
