import type { Route } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, ilike, or, type SQL } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import { db } from "@/db";
import { platformAuditLogs } from "@/db/schema";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit";

const PAGE_SIZE = 50;
const dateTime = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);
const ranges = { "7": "7 hari", "30": "30 hari", "90": "90 hari", all: "Semua" } as const;
const tone = (action: string) => action.startsWith("payment.reject") || action.endsWith(".delete") || action.endsWith(".reject") ? "red"
  : action === "company.enter" ? "gray" : action.startsWith("payment.verify") || action.endsWith(".approve") ? "green" : "orange";

export async function AuditLogPage({ params }: { params: { action?: string; q?: string; range?: string; page?: string } }) {
  const action = params.action && params.action in AUDIT_ACTIONS ? params.action as AuditAction : undefined;
  const q = params.q?.trim().slice(0, 100) || undefined;
  const range = params.range && params.range in ranges ? params.range as keyof typeof ranges : "30";
  const page = Math.max(1, Number(params.page) || 1);
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  const filters: SQL[] = [];
  if (action) filters.push(eq(platformAuditLogs.action, action));
  if (range !== "all") filters.push(gte(platformAuditLogs.createdAt, daysAgo(Number(range))));
  if (q) filters.push(or(ilike(platformAuditLogs.companyName, `%${q}%`), ilike(platformAuditLogs.actorEmail, `%${q}%`), ilike(platformAuditLogs.actorName, `%${q}%`), ilike(platformAuditLogs.summary, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [total], [enters]] = await Promise.all([
    db.select().from(platformAuditLogs).where(where).orderBy(desc(platformAuditLogs.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(platformAuditLogs).where(where),
    db.select({ value: count() }).from(platformAuditLogs).where(and(eq(platformAuditLogs.action, "company.enter"), gte(platformAuditLogs.createdAt, daysAgo(7)))),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total.value) / PAGE_SIZE));
  const link = (next: Partial<typeof params>) => {
    const search = new URLSearchParams();
    const merged = { action, q, range, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) if (value && !(key === "page" && value === "1") && !(key === "range" && value === "30")) search.set(key, value);
    const query = search.toString();
    return `/superadmin/log${query ? `?${query}` : ""}` as Route;
  };

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Log Aktivitas</span><h1>LOG AKTIVITAS SUPERADMIN</h1><p>Jejak setiap tindakan superadmin: perubahan paket, verifikasi pembayaran, akses gratis, kupon, pengumuman, dan masuk ke data perusahaan. Log tidak bisa diubah atau dihapus dari aplikasi.</p></div></header>

    <form className="module-card audit-filters" action="/superadmin/log">
      <label className="field"><span className="field-label">Cari</span><input className="input" name="q" defaultValue={q} placeholder="Perusahaan, email superadmin, atau isi aktivitas" /></label>
      <label className="field"><span className="field-label">Jenis aktivitas</span><select className="input" name="action" defaultValue={action ?? ""}><option value="">Semua aktivitas</option>{Object.entries(AUDIT_ACTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="field"><span className="field-label">Periode</span><select className="input" name="range" defaultValue={range}>{Object.entries(ranges).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="audit-filters-actions">
        <button className="btn btn-primary" type="submit">Terapkan</button>
        {action || q || range !== "30" ? <Link className="btn btn-outline" href="/superadmin/log">Reset</Link> : null}
      </div>
    </form>

    <p className="audit-summary">{Number(total.value).toLocaleString("id-ID")} aktivitas ditemukan · {Number(enters.value)} kali masuk ke data perusahaan dalam 7 hari terakhir</p>

    <section className="module-card industry-table">
      {rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Waktu (WITA)</th><th>Superadmin</th><th>Aktivitas</th><th>Perusahaan</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td className="audit-time">{dateTime(row.createdAt)}</td>
          <td><strong>{row.actorName}</strong><small className="retention-sub">{row.actorEmail}</small></td>
          <td><span className={`badge ${tone(row.action)}`}>{AUDIT_ACTIONS[row.action as AuditAction] ?? row.action}</span></td>
          <td>{row.companyId ? <Link className="retention-company-link" href={`/superadmin/perusahaan/${row.companyId}`}>{row.companyName ?? "—"}</Link> : row.companyName ?? "—"}</td>
          <td className="audit-detail">{row.summary}</td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state"><ScrollText size={26} /><strong>Belum ada aktivitas</strong><span>Tindakan superadmin akan tercatat otomatis di sini.</span></div>}
    </section>

    {pages > 1 ? <nav className="audit-pagination" aria-label="Halaman">
      {page > 1 ? <Link className="btn btn-outline btn-sm" href={link({ page: String(page - 1) })}>‹ Sebelumnya</Link> : <span />}
      <span>Halaman {page} dari {pages}</span>
      {page < pages ? <Link className="btn btn-outline btn-sm" href={link({ page: String(page + 1) })}>Berikutnya ›</Link> : <span />}
    </nav> : null}
  </>;
}
