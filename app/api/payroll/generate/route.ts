import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { generatePayrolls } from "@/features/payroll/server/payroll-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const json = await request.json().catch(() => ({}));
  const schema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2030),
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Pilih bulan dan tahun yang valid untuk generate payroll." },
      { status: 400 },
    );
  }

  try {
    const result = await generatePayrolls(
      context.companyId,
      context.userId,
      parsed.data.month,
      parsed.data.year,
    );

    revalidatePath("/dashboard/payroll");

    return Response.json(result);
  } catch (error) {
    console.error("Generate payrolls error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal generate daftar payroll.";
    return Response.json({ error: message }, { status: 500 });
  }
}
