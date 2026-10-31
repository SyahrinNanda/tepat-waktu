import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { markAllPayrollsDone } from "@/features/payroll/server/payroll-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const json = await request.json().catch(() => ({}));
  const schema = z.object({
    month: z.coerce.number().optional(),
    year: z.coerce.number().optional(),
  });

  const parsed = schema.safeParse(json);
  const month = parsed.success ? parsed.data.month : undefined;
  const year = parsed.success ? parsed.data.year : undefined;

  try {
    const res = await markAllPayrollsDone(context.companyId, { month, year });
    revalidatePath("/dashboard/payroll");
    return Response.json({
      count: res.count,
      message: `Berhasil menyelesaikan ${res.count} payroll menjadi Done.`,
    });
  } catch (error) {
    console.error("Mark all done error:", error);
    return Response.json({ error: "Gagal menyelesaikan payroll." }, { status: 500 });
  }
}
