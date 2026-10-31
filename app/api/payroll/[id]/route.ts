import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import {
  deletePayroll,
  getPayrollById,
  updatePayroll,
} from "@/features/payroll/server/payroll-service";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Params) {
  const context = await featureContext(request, "payroll", "read");
  if ("error" in context) return context.error;

  const { id } = await params;
  const detail = await getPayrollById(context.companyId, id);
  if (!detail) {
    return Response.json({ error: "Payroll tidak ditemukan." }, { status: 404 });
  }

  return Response.json(detail);
}

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";

  let parsedData: {
    status?: string;
    quantity?: number;
    rate?: number;
    salaryType?: string;
    month?: number;
    year?: number;
    slip?: File | null;
  } = {};

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return Response.json({ error: "Data tidak valid." }, { status: 400 });
    }
    const rawFields = Object.fromEntries(
      [...form.entries()].filter(([, value]) => typeof value === "string"),
    );
    const schema = z.object({
      status: z.enum(["New", "Pending", "Done", "Finish"]).optional(),
      salaryType: z.string().optional(),
      quantity: z.coerce.number().optional(),
      rate: z.coerce.number().optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      year: z.coerce.number().int().min(2020).max(2030).optional(),
    });
    const parsed = schema.safeParse(rawFields);
    if (!parsed.success) {
      return Response.json(
        { error: "Data payroll tidak valid." },
        { status: 400 },
      );
    }
    parsedData = parsed.data;
    const slipFile = form.get("slip");
    if (slipFile instanceof File && slipFile.size > 0) {
      parsedData.slip = slipFile;
    }
  } else {
    const json = await request.json().catch(() => ({}));
    const schema = z.object({
      status: z.enum(["New", "Pending", "Done", "Finish"]).optional(),
      salaryType: z.string().optional(),
      quantity: z.coerce.number().optional(),
      rate: z.coerce.number().optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      year: z.coerce.number().int().min(2020).max(2030).optional(),
    });
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Data payroll tidak valid." },
        { status: 400 },
      );
    }
    parsedData = parsed.data;
  }

  try {
    const updated = await updatePayroll(context.companyId, id, {
      status: parsedData.status,
      salaryType: parsedData.salaryType,
      quantity: parsedData.quantity,
      rate: parsedData.rate,
      month: parsedData.month,
      year: parsedData.year,
      slipFile: parsedData.slip,
    });

    revalidatePath("/dashboard/payroll");

    return Response.json({ row: updated });
  } catch (error) {
    console.error("Update payroll error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui payroll.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "payroll", "manage");
  if ("error" in context) return context.error;

  const { id } = await params;

  try {
    const deleted = await deletePayroll(context.companyId, id);
    if (!deleted) {
      return Response.json(
        { error: "Data payroll tidak ditemukan." },
        { status: 404 },
      );
    }

    revalidatePath("/dashboard/payroll");

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Delete payroll error:", error);
    return Response.json(
      { error: "Gagal menghapus payroll." },
      { status: 500 },
    );
  }
}
