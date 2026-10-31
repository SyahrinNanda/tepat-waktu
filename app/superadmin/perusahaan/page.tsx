import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { Building2, Search } from "lucide-react";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import { enterCompany } from "../actions";
export const metadata: Metadata = { title: "Semua Perusahaan" };
type Props = { searchParams: Promise<{ q?: string }> };
export default async function Page({ searchParams }: Props) {
  const query = (await searchParams).q?.trim() ?? "";
  const rows = await db.select({ id: companies.id, name: companies.name, industry: companies.industry, plan: companies.plan, timezone: companies.timezone, createdAt: companies.createdAt, employeeCount: count(employees.id) })
    .from(companies).leftJoin(employees, eq(companies.id, employees.companyId))
    .where(query ? or(ilike(companies.name, `%${query}%`), ilike(companies.industry, `%${query}%`), ilike(companies.plan, `%${query}%`)) : undefined)
    .groupBy(companies.id).orderBy(desc(companies.createdAt));
  return <><header className="product-page-header"><div><span className="breadcrumb">Presensi Super Admin Panel</span><h1>DAFTAR PERUSAHAAN</h1><p>Lihat detail atau masuk ke dashboard perusahaan sebagai Admin.</p></div></header><section className="module-card"><form className="module-toolbar" method="get"><label className="search-control"><Search size={16} /><input name="q" defaultValue={query} placeholder="Cari perusahaan, industri, paket..." /></label><button className="btn btn-outline btn-compact">Cari</button></form>{rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Perusahaan</th><th>Industri</th><th>Paket</th><th>Karyawan</th><th>Zona Waktu</th><th>Terdaftar</th><th>Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.industry}</td><td><span className="status-pill green">{row.plan}</span></td><td>{Number(row.employeeCount)}</td><td>{row.timezone}</td><td>{formatDate(row.createdAt)}</td><td><div className="inline-actions"><Link className="btn btn-sm btn-outline" href={`/superadmin/perusahaan/${row.id}` as Route}>Detail</Link><form action={enterCompany}><input type="hidden" name="companyId" value={row.id} /><button className="btn btn-sm btn-primary" type="submit">Masuk</button></form></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><Building2 size={28} /><strong>Perusahaan tidak ditemukan</strong><span>Ubah kata kunci pencarian.</span></div>}<div className="table-footer"><span>Menampilkan {rows.length} perusahaan</span></div></section></>;
}
function formatDate(value: Date) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(value); }
