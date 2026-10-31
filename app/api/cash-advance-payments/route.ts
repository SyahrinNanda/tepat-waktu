import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import {
  createCashAdvancePayment,
  listCashAdvancePayments,
} from "@/features/cash-advance-payments/server/payment-service";

const createPaymentSchema = z.object({
  cashAdvanceRequestId: z.uuid(),
  paymentDate: z.iso.date(),
  amount: z.coerce.number().int().positive(),
  method: z.enum(["payroll_deduction", "cash", "bank_transfer"]).default("payroll_deduction"),
  note: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const context = await featureContext(request, "kasbon/pembayaran", "read");
  if ("error" in context) return context.error;
  const rows = await listCashAdvancePayments(context.companyId);
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "kasbon/pembayaran", "write");
  if ("error" in context) return context.error;

  const parsed = createPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Kasbon, tanggal, dan nominal pembayaran wajib valid." },
      { status: 400 },
    );
  }

  try {
    const payment = await createCashAdvancePayment(
      context.companyId,
      context.userId,
      parsed.data,
    );
    revalidatePath("/dashboard/kasbon/pembayaran");
    return Response.json({ payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mencatat pembayaran kasbon.";
    return Response.json({ error: message }, { status: 409 });
  }
}
