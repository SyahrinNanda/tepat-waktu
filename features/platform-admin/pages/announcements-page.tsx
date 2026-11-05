import { asc, desc } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import { db } from "@/db";
import { companies, platformAnnouncements } from "@/db/schema";
import { AnnouncementButton } from "../components/announcement-form";
import { announcementState } from "../server/announcements";
import { deleteAnnouncement, setAnnouncementActive } from "../server/announcement-actions";

const dateTime = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);
const witaInput = (value: Date | null) => value ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value).replace(" ", "T") : "";
const toneLabel = { info: "Info", feature: "Fitur baru", maintenance: "Maintenance", warning: "Penting" } as const;

export async function AnnouncementsPage() {
  const [rows, companyRows] = await Promise.all([
    db.select().from(platformAnnouncements).orderBy(desc(platformAnnouncements.startsAt)),
    db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name)),
  ]);
  const companyName = new Map(companyRows.map((company) => [company.id, company.name]));
  const live = rows.filter((row) => announcementState(row).label === "Tayang").length;
  const scheduled = rows.filter((row) => announcementState(row).label === "Terjadwal").length;

  return <>
    <header className="product-page-header"><div><span className="breadcrumb">Super Admin / Pengumuman</span><h1>PENGUMUMAN PLATFORM</h1><p>Kirim informasi maintenance, fitur baru, atau pemberitahuan penting sebagai banner di dashboard semua perusahaan atau perusahaan tertentu.</p></div><AnnouncementButton companies={companyRows} /></header>

    <section className="complaint-tiles industry-tiles">
      <article className="complaint-tile total"><span>Sedang tayang</span><strong>{live}</strong><small>Terlihat di dashboard sekarang</small></article>
      <article className="complaint-tile"><span>Terjadwal</span><strong>{scheduled}</strong><small>Tayang otomatis sesuai waktu mulai</small></article>
      <article className="complaint-tile"><span>Total pengumuman</span><strong>{rows.length}</strong><small>Termasuk yang sudah selesai</small></article>
      <article className="complaint-tile"><span>Perusahaan</span><strong>{companyRows.length}</strong><small>Bisa dipilih sebagai tujuan</small></article>
    </section>

    <section className="module-card industry-table announcement-table">
      {rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Pengumuman</th><th>Tujuan</th><th>Jadwal (WITA)</th><th>Status</th><th aria-label="Aksi" /></tr></thead>
        <tbody>{rows.map((row) => {
          const state = announcementState(row);
          const targets = row.companyIds?.map((id) => companyName.get(id) ?? "Perusahaan terhapus") ?? null;
          return <tr key={row.id}>
            <td className="announcement-cell"><span className={`badge ${row.tone === "warning" ? "red" : row.tone === "maintenance" ? "orange" : row.tone === "feature" ? "green" : "gray"}`}>{toneLabel[row.tone]}</span><strong>{row.title}</strong><small className="retention-sub">{row.message}</small></td>
            <td className="audit-detail">{targets ? (targets.length > 3 ? `${targets.slice(0, 3).join(", ")} +${targets.length - 3}` : targets.join(", ")) : "Semua perusahaan"}<small className="retention-sub">{row.audience === "admins" ? "Hanya Admin Perusahaan" : "Semua akun"}</small></td>
            <td className="audit-detail">{dateTime(row.startsAt)}<small className="retention-sub">{row.endsAt ? `s/d ${dateTime(row.endsAt)}` : "sampai dihentikan"}</small></td>
            <td><span className={`badge ${state.tone}`}>{state.label}</span></td>
            <td className="retention-actions">
              <AnnouncementButton companies={companyRows} draft={{ id: row.id, title: row.title, message: row.message, tone: row.tone, audience: row.audience, companyIds: row.companyIds, linkUrl: row.linkUrl, linkLabel: row.linkLabel, startsAt: witaInput(row.startsAt), endsAt: witaInput(row.endsAt) }} />
              <form action={setAnnouncementActive}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="active" value={row.active ? "false" : "true"} /><button className="btn btn-outline btn-sm" type="submit">{row.active ? "Hentikan" : "Tayangkan"}</button></form>
              <form action={deleteAnnouncement}><input type="hidden" name="id" value={row.id} /><button className="btn btn-outline btn-sm announcement-delete" type="submit">Hapus</button></form>
            </td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="empty-state"><Megaphone size={26} /><strong>Belum ada pengumuman</strong><span>Buat pengumuman untuk menginformasikan maintenance atau fitur baru ke perusahaan.</span></div>}
    </section>
  </>;
}
