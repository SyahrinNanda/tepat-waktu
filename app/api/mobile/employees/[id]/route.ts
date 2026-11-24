import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const input = z.object({
  name: z.string().trim().min(2).max(120), position: z.string().trim().min(1).max(80),
  department: z.string().trim().min(1).max(80), joinedAt: z.iso.date(),
  phone: z.string().trim().max(40).optional(), address: z.string().trim().max(500).optional(),
});
export async function GET(request: Request, { params }: Params) {
  try {
    const context = await selfAttendanceContext(request);
    if (!["hrd", "general_manager"].includes(context.role)) return Response.json({ error: "Akses ditolak." }, { status: 403 });
    if (!z.uuid().safeParse((await params).id).success) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const [row] = await db.select({
      id: employees.id, name: employees.name, email: employees.email,
      employeeCode: employees.employeeCode, position: employees.position,
      department: employees.department, joinedAt: employees.joinedAt,
      phone: employees.phone, address: employees.address,
    }).from(employees).where(and(eq(employees.id, (await params).id), eq(employees.companyId, context.companyId))).limit(1);
    return row ? Response.json({ row }) : Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile employee detail failed", error);
    return Response.json({ error: "Data karyawan belum dapat dimuat." }, { status: 500 });
  }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await selfAttendanceContext(request);
    if (!["hrd", "general_manager"].includes(context.role)) return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const id = (await params).id;
    if (!z.uuid().safeParse(id).success) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Data karyawan tidak valid." }, { status: 400 });
    const [row] = await db.update(employees).set({ ...parsed.data, phone: parsed.data.phone || null, address: parsed.data.address || null })
      .where(and(eq(employees.id, id), eq(employees.companyId, context.companyId)))
      .returning({ id: employees.id, name: employees.name });
    return row ? Response.json({ row }) : Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile employee update failed", error);
    return Response.json({ error: "Karyawan belum dapat diperbarui." }, { status: 500 });
  }
}
