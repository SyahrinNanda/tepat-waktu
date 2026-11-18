import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { positionBodySchema, listPositionsWithSchedules, replacePositionSchedules, schedulesBelongToCompany } from "@/features/master-data/positions/server/position-schedules";

export async function GET(request: Request) {
  const context = await featureContext(request, "master/jabatan", "read"); if ("error" in context) return context.error;
  return Response.json({ rows: await listPositionsWithSchedules(context.companyId) });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/jabatan", "write"); if ("error" in context) return context.error;
  const parsed = positionBodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Nama dan minimal satu jadwal kerja wajib diisi." }, { status: 400 });
  const { scheduleIds, ...values } = parsed.data;
  if (!(await schedulesBelongToCompany(context.companyId, scheduleIds))) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(positions).values({ companyId: context.companyId, ...values, scheduleId: scheduleIds[0] }).returning({ id: positions.id });
      await replacePositionSchedules(tx, row.id, scheduleIds);
      return row.id;
    });
    revalidatePath("/dashboard/master/jabatan");
    const [row] = await listPositionsWithSchedules(context.companyId, id);
    return Response.json({ row }, { status: 201 });
  } catch { return Response.json({ error: "Nama jabatan sudah digunakan." }, { status: 409 }); }
}
