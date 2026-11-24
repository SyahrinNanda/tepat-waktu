import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { employeeCapacity } from "@/features/subscriptions/server/employee-capacity";
import { employeeEmailConflict } from "@/features/employees/server/employee-email";
import { provisionEmployeeAccount } from "@/features/invitations/server/employee-account";
import { accessScope, employeeScopeFilter } from "@/features/access/team-scope";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    if (context.role === "employee") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const rows = await db.select({
      id: employees.id, name: employees.name, employeeCode: employees.employeeCode,
      email: employees.email, position: employees.position, department: employees.department,
      status: employees.status, joinedAt: employees.joinedAt,
    }).from(employees).where(and(eq(employees.companyId, context.companyId), employeeScopeFilter(await accessScope(context)))).orderBy(asc(employees.name));
    return Response.json({ rows });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile employees failed", error);
    return Response.json({ error: "Data karyawan belum dapat dimuat." }, { status: 500 });
  }
}

const input = z.object({
  name: z.string().trim().min(2).max(120), email: z.email(), employeeCode: z.string().trim().max(30).optional(),
  position: z.string().trim().min(1).max(80), department: z.string().trim().min(1).max(80),
  joinedAt: z.iso.date(), gender: z.enum(["male", "female", "unspecified"]).default("unspecified"),
  phone: z.string().trim().max(40).optional(), address: z.string().trim().max(500).optional(),
  createAccount: z.boolean().default(false),
});
export async function POST(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    if (!["hrd", "general_manager"].includes(context.role)) return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Data karyawan tidak valid." }, { status: 400 });
    if ((await employeeCapacity(context.companyId)).full) return Response.json({ error: "Batas karyawan paket sudah tercapai." }, { status: 409 });
    const conflict = await employeeEmailConflict(context.companyId, parsed.data.email, { createAccount: parsed.data.createAccount });
    if (conflict) return Response.json({ error: conflict }, { status: 409 });
    const { createAccount, ...data } = parsed.data;
    const [row] = await db.insert(employees).values({
      ...data, companyId: context.companyId, email: data.email.toLowerCase(),
      employeeCode: data.employeeCode || `EMP-${randomUUID().slice(0, 8).toUpperCase()}`,
      phone: data.phone || null, address: data.address || null,
    }).returning({ id: employees.id, name: employees.name });
    if (createAccount) await provisionEmployeeAccount({ companyId: context.companyId, employeeId: row.id, actor: { id: context.userId, name: context.employeeName } }).catch((error) => console.error("Mobile employee invitation failed", error));
    return Response.json({ row }, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile employee create failed", error);
    return Response.json({ error: "Karyawan belum dapat ditambahkan." }, { status: 500 });
  }
}