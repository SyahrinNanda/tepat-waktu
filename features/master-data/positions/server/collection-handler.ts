import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { divisions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { divisionBodySchema, listDivisionsWithSchedules, replaceDivisionSchedules, schedulesBelongToCompany } from "@/features/master-data/divisions/server/division-schedules";

export async function GET(request: Request) {
  const context = await featureContext(request, "master/divisi", "read"); if ("error" in context) return context.error;
  return Response.json({ rows: await listDivisionsWithSchedules(context.companyId) });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/divisi", "write"); if ("error" in context) return context.error;
  const parsed = divisionBodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Nama dan minimal satu jadwal kerja wajib diisi." }, { status: 400 });
  const { scheduleIds, ...values } = parsed.data;
  if (!(await schedulesBelongToCompany(context.companyId, scheduleIds))) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(divisions).values({ companyId: context.companyId, ...values, scheduleId: scheduleIds[0] }).returning({ id: divisions.id });
      await replaceDivisionSchedules(tx, row.id, scheduleIds);
      return row.id;
    });
    revalidatePath("/dashboard/master/divisi");
    const [row] = await listDivisionsWithSchedules(context.companyId, id);
    return Response.json({ row }, { status: 201 });
  } catch { return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 }); }
}
