import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attendanceLocations } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { attendanceLocationInput } from "./schemas";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/lokasi-presensi", "write");
  if ("error" in context) return context.error;
  const parsed = attendanceLocationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data lokasi kehadiran tidak valid." }, { status: 400 });
  try {
    const [row] = await db.update(attendanceLocations).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(attendanceLocations.id, (await params).id), eq(attendanceLocations.companyId, context.companyId))).returning();
    if (!row) return Response.json({ error: "Lokasi kehadiran tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/lokasi-presensi");
    return Response.json({ row });
  } catch {
    return Response.json({ error: "Nama lokasi kehadiran sudah digunakan." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/lokasi-presensi", "manage");
  if ("error" in context) return context.error;
  const [row] = await db.delete(attendanceLocations).where(and(eq(attendanceLocations.id, (await params).id), eq(attendanceLocations.companyId, context.companyId))).returning({ id: attendanceLocations.id });
  if (!row) return Response.json({ error: "Lokasi kehadiran tidak ditemukan." }, { status: 404 });
  revalidatePath("/dashboard/master/lokasi-presensi");
  return Response.json({ ok: true });
}
