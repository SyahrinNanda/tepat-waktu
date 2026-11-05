"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, platformAnnouncements } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/superadmin";

export type AnnouncementFormState = { status: "idle" | "success" | "error"; message: string };
const WITA = "+08:00";
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const toneLabel = { info: "Info", feature: "Fitur baru", maintenance: "Maintenance", warning: "Penting" } as const;

function refresh() {
  revalidatePath("/superadmin/pengumuman");
  revalidatePath("/dashboard", "layout");
}

export async function saveAnnouncement(_previous: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const session = await requireSuperAdmin();
  const parsed = z.object({
    id: z.uuid().optional().or(z.literal("")),
    title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(120),
    message: z.string().trim().min(3, "Isi pengumuman minimal 3 karakter.").max(600),
    tone: z.enum(["info", "feature", "maintenance", "warning"]),
    audience: z.enum(["all", "admins"]),
    target: z.enum(["all", "selected"]),
    linkUrl: z.string().trim().max(300).optional().or(z.literal("")),
    linkLabel: z.string().trim().max(40).optional().or(z.literal("")),
    startsAt: dateTime.optional().or(z.literal("")),
    endsAt: dateTime.optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data pengumuman tidak valid." };
  const data = parsed.data;

  // Links may point inside the app (/dashboard/...) or to an https page; nothing else.
  if (data.linkUrl && !/^(\/(?!\/)|https:\/\/)/.test(data.linkUrl)) return { status: "error", message: "Tautan harus diawali / (halaman aplikasi) atau https://." };
  let companyIds: string[] | null = null;
  if (data.target === "selected") {
    const picked = [...new Set(formData.getAll("companyIds").map(String))].filter((value) => z.uuid().safeParse(value).success);
    if (!picked.length) return { status: "error", message: "Pilih minimal satu perusahaan tujuan." };
    const found = await db.select({ id: companies.id }).from(companies).where(inArray(companies.id, picked));
    companyIds = found.map((row) => row.id);
  }
  const startsAt = data.startsAt ? new Date(`${data.startsAt}:00${WITA}`) : new Date();
  const endsAt = data.endsAt ? new Date(`${data.endsAt}:00${WITA}`) : null;
  if (endsAt && endsAt <= startsAt) return { status: "error", message: "Waktu selesai harus setelah waktu mulai." };

  const values = {
    title: data.title, message: data.message, tone: data.tone, audience: data.audience, companyIds,
    linkUrl: data.linkUrl || null, linkLabel: data.linkUrl ? data.linkLabel || "Selengkapnya" : null, startsAt, endsAt, updatedAt: new Date(),
  };
  const target = companyIds ? `${companyIds.length} perusahaan` : "semua perusahaan";
  await db.transaction(async (tx) => {
    if (data.id) {
      await tx.update(platformAnnouncements).set(values).where(eq(platformAnnouncements.id, data.id));
      await recordAudit(session, { action: "announcement.update", summary: `Mengubah pengumuman "${data.title}" (${toneLabel[data.tone]}, ${target})`, metadata: { id: data.id, ...values } }, tx);
    } else {
      const [created] = await tx.insert(platformAnnouncements).values({ ...values, createdBy: session.user.id }).returning({ id: platformAnnouncements.id });
      await recordAudit(session, { action: "announcement.create", summary: `Membuat pengumuman "${data.title}" (${toneLabel[data.tone]}, ${target}${data.audience === "admins" ? ", hanya admin" : ""})`, metadata: { id: created.id, ...values } }, tx);
    }
  });
  refresh();
  return { status: "success", message: data.id ? "Pengumuman diperbarui." : startsAt > new Date() ? "Pengumuman dijadwalkan." : "Pengumuman sudah tayang di dashboard perusahaan." };
}

export async function setAnnouncementActive(formData: FormData) {
  const session = await requireSuperAdmin();
  const { id, active } = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  const [row] = await db.update(platformAnnouncements).set({ active: active === "true", updatedAt: new Date() }).where(eq(platformAnnouncements.id, id)).returning({ title: platformAnnouncements.title });
  if (row) await recordAudit(session, { action: "announcement.update", summary: `${active === "true" ? "Menayangkan" : "Menghentikan"} pengumuman "${row.title}"`, metadata: { id, active } });
  refresh();
}

export async function deleteAnnouncement(formData: FormData) {
  const session = await requireSuperAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const [row] = await db.delete(platformAnnouncements).where(eq(platformAnnouncements.id, id)).returning({ title: platformAnnouncements.title });
  if (row) await recordAudit(session, { action: "announcement.delete", summary: `Menghapus pengumuman "${row.title}"`, metadata: { id } });
  refresh();
}
