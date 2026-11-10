import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attendanceLocations } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { attendanceLocationInput } from "./schemas";

export async function GET(request: Request) {
  const context = await featureContext(request, "master/lokasi-presensi", "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(attendanceLocations).where(eq(attendanceLocations.companyId, context.companyId)).orderBy(asc(attendanceLocations.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/lokasi-presensi", "write");
  if ("error" in context) return context.error;
  const parsed = attendanceLocationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Lengkapi nama, tipe, alamat, koordinat, dan radius lokasi." }, { status: 400 });
  try {
    const [row] = await db.insert(attendanceLocations).values({ companyId: context.companyId, ...parsed.data }).returning();
    revalidatePath("/dashboard/master/lokasi-presensi");
    return Response.json({ row }, { status: 201 });
  } catch {
    return Response.json({ error: "Nama lokasi kehadiran sudah digunakan." }, { status: 409 });
  }
}
