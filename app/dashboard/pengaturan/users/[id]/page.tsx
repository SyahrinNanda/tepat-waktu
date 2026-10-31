import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, employees, user } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { SubmitButton } from "@/components/submit-button";
import { removeCompanyUser, updateCompanyUserRole } from "../actions";

export const metadata: Metadata = { title: "Detail User" };
type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const context = await requireCompanyRole(["admin"]);
  const { id } = await params;
  const [member] = await db.select({ id: companyMembers.id, role: companyMembers.role, userId: user.id, name: user.name, email: user.email, createdAt: companyMembers.createdAt, emailVerified: user.emailVerified })
    .from(companyMembers).innerJoin(user, eq(companyMembers.userId, user.id))
    .where(and(eq(companyMembers.id, id), eq(companyMembers.companyId, context.companyId))).limit(1);
  if (!member) notFound();
  const [employee] = await db.select({ id: employees.id, name: employees.name, code: employees.employeeCode }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.userId, member.userId))).limit(1);
  return <><header className="product-page-header"><div><span className="breadcrumb">Beranda / Pengaturan / User Login / Detail</span><h1>{member.name}</h1><p>{member.email}</p></div><Link className="btn btn-outline" href="/dashboard/pengaturan/users">Kembali</Link></header><section className="detail-layout"><div className="detail-main"><div className="module-card detail-section"><div className="detail-section-head"><div><h2>Informasi Akun</h2></div></div><div className="detail-grid"><Info label="Nama" value={member.name} /><Info label="Email" value={member.email} /><Info label="Status email" value={member.emailVerified ? "Terverifikasi" : "Belum terverifikasi"} /><Info label="Karyawan terkait" value={employee ? `${employee.name} (${employee.code})` : "Belum terhubung"} /></div></div></div><aside className="detail-side"><section className="module-card detail-section"><h2>Role Perusahaan</h2><form action={updateCompanyUserRole}><input type="hidden" name="memberId" value={member.id} /><select className="input" name="role" defaultValue={member.role === "owner" ? "admin" : member.role}><option value="admin">Admin Perusahaan</option><option value="general_manager">General Manager</option><option value="hrd">HRD</option><option value="manager">Manager</option><option value="employee">Karyawan / Staf</option></select><div className="action-row"><SubmitButton pendingLabel="Menyimpan...">Simpan Role</SubmitButton></div></form><div className="form-divider" /><h2>Cabut Akses</h2><p className="form-help">Membership perusahaan dan tautan karyawan akan dilepas. Akun login tidak dihapus permanen.</p><form action={removeCompanyUser}><input type="hidden" name="memberId" value={member.id} /><SubmitButton className="btn btn-danger btn-block" pendingLabel="Mencabut akses...">Cabut Akses Perusahaan</SubmitButton></form></section></aside></section></>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>; }
