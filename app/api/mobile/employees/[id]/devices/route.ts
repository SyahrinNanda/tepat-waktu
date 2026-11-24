import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { employeeDevices, signOutDevicesFor } from "@/features/employees/server/device-service";
import { mobileFailure, mobileHrContext, uuidParam } from "@/features/employees/server/mobile-hr-context";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/** GET: devices the employee is signed in on or checked in from. */
export async function GET(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id } = await params;
    if (!uuidParam(id)) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const [employee] = await db.select({ userId: employees.userId }).from(employees).where(and(eq(employees.id, id), eq(employees.companyId, context.companyId))).limit(1);
    if (!employee) return Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
    return Response.json({ rows: await employeeDevices(context.companyId, id, employee.userId), hasAccount: Boolean(employee.userId) });
  } catch (error) { return mobileFailure(error, "Mobile devices list failed"); }
}

/** DELETE `{ sessionIds: string[] | "all" }`: signs the employee out of those devices. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id } = await params;
    if (!uuidParam(id)) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const body = await request.json().catch(() => null);
    const parsed = z.object({ sessionIds: z.union([z.literal("all"), z.array(z.string().min(1).max(200)).min(1).max(100)]) }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "Perangkat tidak valid." }, { status: 400 });
    const result = await signOutDevicesFor(context.companyId, id, parsed.data.sessionIds);
    return result.ok ? Response.json(result) : Response.json({ error: result.error }, { status: 400 });
  } catch (error) { return mobileFailure(error, "Mobile devices sign-out failed"); }
}
