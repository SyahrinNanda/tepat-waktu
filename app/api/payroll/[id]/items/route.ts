import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { savePayrollItem } from "@/features/payroll/server/payroll-service";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, { params }: Params) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  if (!json) return Response.json({ error: "Data item tidak valid." }, { status: 400 });

  const schema = z.object({
    id: z.string().uuid().optional(),
    category: z.enum(["compensation", "deduction"]),
    name: z.string().trim().min(1, "Nama komponen wajib diisi."),
    rate: z.coerce.number().min(0).default(0),
    quantity: z.coerce.number().min(0).default(1),
    salaryType: z.string().optional().default("bulan"),
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Format data tidak valid." },
      { status: 400 },
    );
  }

  try {
    const detail = await savePayrollItem(context.companyId, id, parsed.data);
    revalidatePath("/dashboard/payroll");
    return Response.json(detail);
  } catch (error) {
    console.error("Save payroll item error:", error);
    const message = error instanceof Error ? error.message : "Gagal menyimpan item.";
    return Response.json({ error: message }, { status: 500 });
  }
}
