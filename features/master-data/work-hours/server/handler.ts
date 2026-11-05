import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { workScheduleDays, workSchedules } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const daySchema = z.object({ dayOfWeek: z.number().int().min(1).max(7), enabled: z.boolean(), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
const schema = z.object({ scheduleId: z.uuid(), days: z.array(daySchema).length(7) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/jam-kerja", "read"); if ("error" in context) return context.error;
  const scheduleId = new URL(request.url).searchParams.get("scheduleId");
  if (!scheduleId) return Response.json({ rows: [] });
  const [schedule] = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.id, scheduleId), eq(workSchedules.companyId, context.companyId))).limit(1);
  if (!schedule) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  const rows = await db.select().from(workScheduleDays).where(eq(workScheduleDays.scheduleId, schedule.id)).orderBy(asc(workScheduleDays.dayOfWeek));
  return Response.json({ rows });
}

export async function PUT(request: Request) {
  const context = await featureContext(request, "master/jam-kerja", "write"); if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Jam kerja Senin sampai Minggu wajib diisi dengan benar." }, { status: 400 });
  const [schedule] = await db.select().from(workSchedules).where(and(eq(workSchedules.id, parsed.data.scheduleId), eq(workSchedules.companyId, context.companyId))).limit(1);
  if (!schedule) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  if (new Set(parsed.data.days.map((day) => day.dayOfWeek)).size !== 7) return Response.json({ error: "Setiap hari hanya boleh muncul satu kali." }, { status: 400 });
  await db.transaction(async (tx) => {
    for (const day of parsed.data.days) await tx.insert(workScheduleDays).values({ scheduleId: schedule.id, ...day, startTime: `${day.startTime}:00`, endTime: `${day.endTime}:00` }).onConflictDoUpdate({ target: [workScheduleDays.scheduleId, workScheduleDays.dayOfWeek], set: { enabled: day.enabled, startTime: `${day.startTime}:00`, endTime: `${day.endTime}:00`, updatedAt: new Date() } });
    const monday = parsed.data.days.find((day) => day.enabled) ?? parsed.data.days[0];
    await tx.update(workSchedules).set({ startTime: `${monday.startTime}:00`, endTime: `${monday.endTime}:00`, workDays: parsed.data.days.filter((day) => day.enabled).map((day) => day.dayOfWeek).join(",") }).where(eq(workSchedules.id, schedule.id));
  });
  revalidatePath("/dashboard/master/jam-kerja"); revalidatePath("/dashboard/presensi/check-in"); return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const context = await featureContext(request, "master/jam-kerja", "manage"); if ("error" in context) return context.error;
  const scheduleId = new URL(request.url).searchParams.get("scheduleId"); if (!scheduleId) return Response.json({ error: "Jadwal kerja wajib dipilih." }, { status: 400 });
  const [schedule] = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.id, scheduleId), eq(workSchedules.companyId, context.companyId))).limit(1);
  if (!schedule) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  await db.delete(workScheduleDays).where(eq(workScheduleDays.scheduleId, schedule.id)); revalidatePath("/dashboard/master/jam-kerja"); return Response.json({ ok: true });
}
