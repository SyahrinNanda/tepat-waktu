import { pushToComplaintHandlers } from "@/features/notifications/server/push";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeComplaints } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { categoryKeys, statusKeys } from "@/features/complaints/config";
import { listCompanyComplaints, listOwnComplaints, reporterKey } from "@/features/complaints/server/complaint-service";

export const runtime = "nodejs";
const input = z.object({
  category: z.enum(categoryKeys), title: z.string().trim().min(5).max(150),
  description: z.string().trim().min(20).max(5000),
  incidentDate: z.union([z.iso.date(), z.literal("")]).optional(),
  incidentLocation: z.string().trim().max(200).optional(),
  involvedParties: z.string().trim().max(500).optional(),
  anonymous: z.boolean().default(false),
});
function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile complaints failed", error);
  return Response.json({ error: "Keluhan belum dapat diproses." }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const rows = context.role === "hrd"
      ? await listCompanyComplaints(context.companyId)
      : await listOwnComplaints(context.companyId, reporterKey(context.companyId, context.userId));
    return Response.json({ rows });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Data keluhan tidak valid." }, { status: 400 });
    const { anonymous, incidentDate, incidentLocation, involvedParties, ...fields } = parsed.data;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ticketCode = `KLH-${new Date().toISOString().slice(2, 7).replace("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
      try {
        const [row] = await db.insert(employeeComplaints).values({
          companyId: context.companyId, ticketCode, ...fields, anonymous,
          incidentDate: incidentDate || null, incidentLocation: incidentLocation || null,
          involvedParties: involvedParties || null,
          reporterKey: reporterKey(context.companyId, context.userId),
          reporterUserId: anonymous ? null : context.userId,
          reporterName: anonymous ? null : context.employeeName,
        }).returning({ id: employeeComplaints.id, ticketCode: employeeComplaints.ticketCode });
        pushToComplaintHandlers(context.companyId, { title: `Keluhan baru: ${fields.title}`, body: `${row.ticketCode} · ${anonymous ? "Anonim" : context.employeeName}`, href: `/karyawan/keluhan/${row.id}` });
        return Response.json({ row }, { status: 201 });
      } catch (error) {
        const code = typeof error === "object" && error && "cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause ? error.cause.code : undefined;
        if (code !== "23505") throw error;
      }
    }
    return Response.json({ error: "Keluhan belum dapat disimpan." }, { status: 500 });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    if (context.role !== "hrd") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const parsed = z.object({ id: z.uuid(), status: z.enum(statusKeys), responseNote: z.string().trim().max(3000) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Data tindak lanjut tidak valid." }, { status: 400 });
    const [row] = await db.update(employeeComplaints).set({ status: parsed.data.status, responseNote: parsed.data.responseNote || null, handledBy: context.userId, handledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(employeeComplaints.id, parsed.data.id), eq(employeeComplaints.companyId, context.companyId)))
      .returning({ id: employeeComplaints.id, status: employeeComplaints.status });
    return row ? Response.json({ row }) : Response.json({ error: "Keluhan tidak ditemukan." }, { status: 404 });
  } catch (error) { return failure(error); }
}
