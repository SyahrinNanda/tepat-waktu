import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import {
  createPayroll,
  listPayrolls,
} from "@/features/payroll/server/payroll-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await featureContext(request, "payroll", "read");
  if ("error" in context) return context.error;

  const url = new URL(request.url);
  const query = url.searchParams.get("query") || undefined;
  const month = url.searchParams.get("month")
    ? Number(url.searchParams.get("month"))
    : undefined;
  const year = url.searchParams.get("year")
    ? Number(url.searchParams.get("year"))
    : undefined;
  const status = url.searchParams.get("status") || undefined;

  const rows = await listPayrolls(context.companyId, {
    query,
    month,
    year,
    status,
  });

  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json(
      { error: "Data payroll tidak valid." },
      { status: 400 },
    );
  }

  const rawFields = Object.fromEntries(
    [...form.entries()].filter(([, value]) => typeof value === "string"),
  );

  const parsed = z
    .object({
      employeeId: z.string().uuid("Karyawan wajib dipilih."),
      month: z.coerce.number().int().min(1).max(12),
      year: z.coerce.number().int().min(2020).max(2030),
      salaryType: z.string().trim().min(1).default("Bulan"),
      quantity: z.coerce.number().min(0).default(0),
      rate: z.coerce.number().min(0).default(0),
    })
    .safeParse(rawFields);

  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues[0]?.message || "Lengkapi formulir payroll dengan benar.";
    return Response.json({ error: errorMsg }, { status: 400 });
  }

  const slipFile = form.get("slip");
  const slip = slipFile instanceof File && slipFile.size > 0 ? slipFile : null;

  try {
    const created = await createPayroll(context.companyId, context.userId, {
      employeeId: parsed.data.employeeId,
      month: parsed.data.month,
      year: parsed.data.year,
      salaryType: parsed.data.salaryType,
      quantity: parsed.data.quantity,
      rate: parsed.data.rate,
      slipFile: slip,
    });

    revalidatePath("/dashboard/payroll");

    return Response.json({ row: created }, { status: 201 });
  } catch (error) {
    console.error("Create payroll error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal menambahkan payroll.";
    return Response.json({ error: message }, { status: 500 });
  }
}
