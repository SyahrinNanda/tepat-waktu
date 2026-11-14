import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { createVisit, listVisits } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await featureContext(request, "kunjungan", "read");
  if ("error" in context) return context.error;
  const params = new URL(request.url).searchParams;
  let ownEmployeeId: string | undefined;
  if (context.role === "employee") {
    ownEmployeeId = await ownEmployee(context.companyId, context.userId);
    if (!ownEmployeeId) return Response.json({ rows: [] });
  }
  return Response.json({ rows: await listVisits(context.companyId, params.get("from") || undefined, params.get("to") || undefined, ownEmployeeId) });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "kunjungan", "write");
  if ("error" in context) return context.error;
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Data kunjungan tidak valid." }, { status: 400 });

  const rawFields = Object.fromEntries(
    [...form.entries()].filter(([, value]) => typeof value === "string"),
  );

  const parsed = z
    .object({
      employeeId: z.string().uuid("Karyawan wajib dipilih."),
      locationId: z.union([z.string().uuid(), z.literal("")]).optional(),
      visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid."),
      outletName: z.string().trim().max(160).optional(),
      latitude: z.union([z.coerce.number().min(-90).max(90), z.literal("")]).optional(),
      longitude: z.union([z.coerce.number().min(-180).max(180), z.literal("")]).optional(),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse(rawFields);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Lengkapi formulir dengan benar.";
    return Response.json({ error: errorMsg }, { status: 400 });
  }

  // Staff (role "employee") may only record visits for themselves.
  if (context.role === "employee" && parsed.data.employeeId !== await ownEmployee(context.companyId, context.userId)) {
    return Response.json({ error: "Anda hanya dapat mencatat kunjungan untuk diri sendiri." }, { status: 403 });
  }

  // Handle selfie
  const selfieFile = form.get("selfie");
  const selfie = selfieFile instanceof File && selfieFile.size > 0 ? selfieFile : null;
  // Only company admins (owner counts as admin) may upload a selfie from a file; everyone else
  // must take it with the live camera in the visit form.
  if (!selfieUploadAllowed(context.role) && (!selfie || form.get("selfieSource") !== "camera")) {
    return Response.json({ error: "Foto selfie wajib diambil langsung dari kamera." }, { status: 400 });
  }

  // Handle attachments
  const attachments: (File | null)[] = [];
  const att1 = form.get("attachment1");
  const att2 = form.get("attachment2");
  const att3 = form.get("attachment3");

  if (att1 instanceof File && att1.size > 0) attachments.push(att1);
  if (att2 instanceof File && att2.size > 0) attachments.push(att2);
  if (att3 instanceof File && att3.size > 0) attachments.push(att3);

  // If attachments were sent as multiple "attachments" fields
  if (attachments.length === 0) {
    const genericAtts = form.getAll("attachments").filter((v): v is File => v instanceof File && v.size > 0);
    attachments.push(...genericAtts.slice(0, 3));
  }

  // The visit time is the moment of submission in the company time zone, never typed by hand.
  const [company] = await db.select({ timezone: companies.timezone }).from(companies).where(eq(companies.id, context.companyId)).limit(1);
  const visitTime = new Intl.DateTimeFormat("en-GB", { timeZone: company?.timezone ?? "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

  try {
    await createVisit({
      ...parsed.data,
      visitTime,
      latitude: parsed.data.latitude === "" ? undefined : parsed.data.latitude,
      longitude: parsed.data.longitude === "" ? undefined : parsed.data.longitude,
      companyId: context.companyId,
      userId: context.userId,
      selfie,
      attachments,
    });
    revalidatePath("/dashboard/kunjungan");
    revalidatePath("/dashboard/kunjungan/laporan");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kunjungan gagal disimpan." },
      { status: 400 },
    );
  }
}

async function ownEmployee(companyId: string, userId: string) {
  const [row] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.userId, userId), eq(employees.status, "active"))).limit(1);
  return row?.id;
}

function selfieUploadAllowed(role: string) {
  return role === "admin" || role === "owner";
}
