import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { and, count, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, deletionRequests, user } from "@/db/schema";
import { DeletionRequestActions } from "@/features/account-requests/components/deletion-request-actions";
import { companiesLeftWithoutAdmin } from "@/features/account-requests/server/deletion";
import { requireSuperAdmin } from "@/lib/superadmin";

export const metadata: Metadata = { title: "Permintaan Hapus Akun" };

const TABS = {
  queue: { label: "Perlu ditinjau", where: and(eq(deletionRequests.status, "pending"), isNotNull(deletionRequests.confirmedAt)) },
  unconfirmed: { label: "Belum dikonfirmasi", where: and(eq(deletionRequests.status, "pending"), isNull(deletionRequests.confirmedAt)) },
  processed: { label: "Akun dihapus", where: eq(deletionRequests.status, "processed") },
  rejected: { label: "Ditolak", where: eq(deletionRequests.status, "rejected") },
} satisfies Record<string, { label: string; where: SQL | undefined }>;
type Tab = keyof typeof TABS;

const ROLE_LABEL: Record<string, string> = { owner: "Admin", admin: "Admin", general_manager: "General Manager", hrd: "HRD", manager: "Manager", employee: "Karyawan" };
const when = (value: Date | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value) : "—";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSuperAdmin();
  const requested = (await searchParams).tab;
  const tab: Tab = requested && requested in TABS ? requested as Tab : "queue";
  const now = new Date();

  const [rows, ...counts] = await Promise.all([
    db.select({
      id: deletionRequests.id, email: deletionRequests.email, userId: deletionRequests.userId, reason: deletionRequests.reason,
      createdAt: deletionRequests.createdAt, confirmedAt: deletionRequests.confirmedAt, tokenExpiresAt: deletionRequests.tokenExpiresAt,
      processedAt: deletionRequests.processedAt, processedBy: deletionRequests.processedBy, note: deletionRequests.note, name: user.name,
    }).from(deletionRequests).leftJoin(user, eq(user.id, deletionRequests.userId)).where(TABS[tab].where).orderBy(desc(deletionRequests.createdAt)).limit(200),
    ...Object.values(TABS).map((item) => db.select({ value: count() }).from(deletionRequests).where(item.where)),
  ]);
  const totals = Object.fromEntries(Object.keys(TABS).map((key, index) => [key, Number(counts[index][0]?.value ?? 0)])) as Record<Tab, number>;

  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const memberships = userIds.length ? await db.select({ userId: companyMembers.userId, company: companies.name, role: companyMembers.role })
    .from(companyMembers).innerJoin(companies, eq(companies.id, companyMembers.companyId)).where(inArray(companyMembers.userId, userIds)) : [];
  const companiesOf = new Map<string, string[]>();
  for (const row of memberships) companiesOf.set(row.userId, [...(companiesOf.get(row.userId) ?? []), `${row.company} (${ROLE_LABEL[row.role] ?? row.role})`]);
  const pendingTab = tab === "queue" || tab === "unconfirmed";
  const blocked = new Map(pendingTab ? await Promise.all(userIds.map(async (id) => [id, await companiesLeftWithoutAdmin(id)] as const)) : []);

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Permintaan Hapus Akun</span><h1>PERMINTAAN HAPUS AKUN</h1><p>Permintaan dari halaman Penghapusan Akun. Permintaan masuk antrean setelah pemilik email mengklik tautan konfirmasi. Memproses permintaan menghapus akun beserta sesi dan keanggotaan perusahaannya; data perusahaan tidak ikut terhapus.</p></div></header>

    <nav className="deletion-tabs" aria-label="Status permintaan">
      {(Object.keys(TABS) as Tab[]).map((key) => <Link key={key} href={`/superadmin/penghapusan-akun?tab=${key}` as Route} className={`deletion-tab ${tab === key ? "is-active" : ""}`} aria-current={tab === key ? "page" : undefined}>{TABS[key].label}<span>{totals[key]}</span></Link>)}
    </nav>

    <section className="module-card industry-table deletion-table">
      {rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Akun</th><th>Perusahaan</th><th>Alasan</th><th>Diajukan</th><th>{pendingTab ? "Konfirmasi" : "Diputuskan"}</th><th>Status</th>{pendingTab && <th aria-label="Aksi" />}</tr></thead>
        <tbody>{rows.map((row) => {
          const expired = !row.confirmedAt && (!row.tokenExpiresAt || row.tokenExpiresAt <= now);
          const status = tab === "processed" ? { label: "Akun dihapus", tone: "green" }
            : tab === "rejected" ? { label: "Ditolak", tone: "red" }
            : row.confirmedAt ? { label: "Perlu ditinjau", tone: "orange" }
            : expired ? { label: "Tautan kedaluwarsa", tone: "gray" } : { label: "Menunggu konfirmasi", tone: "gray" };
          const blockedBy = row.userId ? blocked.get(row.userId) ?? [] : [];
          return <tr key={row.id}>
            <td><strong>{row.email}</strong><small className="retention-sub">{row.name ?? (tab === "processed" ? "Akun sudah dihapus" : "Akun tidak ditemukan")}</small></td>
            <td className="audit-detail">{row.userId && companiesOf.get(row.userId)?.length ? companiesOf.get(row.userId)!.join(", ") : "—"}
              {blockedBy.length > 0 && <small className="deletion-warning">Satu-satunya admin di {blockedBy.join(", ")}</small>}</td>
            <td className="audit-detail">{row.reason || "—"}</td>
            <td className="audit-time">{when(row.createdAt)}</td>
            <td className="audit-time">{pendingTab ? (row.confirmedAt ? when(row.confirmedAt) : expired ? "Kedaluwarsa" : "Belum") : <>{when(row.processedAt)}{row.processedBy && <small className="retention-sub">oleh {row.processedBy}</small>}</>}
              {tab === "rejected" && row.note && <small className="retention-sub">Alasan: {row.note}</small>}</td>
            <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
            {pendingTab && <td className="retention-actions"><DeletionRequestActions id={row.id} email={row.email} confirmed={Boolean(row.confirmedAt)} blockedBy={blockedBy} /></td>}
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state">{tab === "queue" ? "Tidak ada permintaan yang perlu ditinjau." : "Belum ada permintaan dengan status ini."}</div>}
    </section>
  </>;
}
