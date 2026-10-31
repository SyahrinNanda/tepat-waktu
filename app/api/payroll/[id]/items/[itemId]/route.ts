import { revalidatePath } from "next/cache";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { deletePayrollItem } from "@/features/payroll/server/payroll-service";

type Params = { params: Promise<{ id: string; itemId: string }> };

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "payroll", "write");
  if ("error" in context) return context.error;

  const { id, itemId } = await params;

  try {
    const detail = await deletePayrollItem(context.companyId, id, itemId);
    revalidatePath("/dashboard/payroll");
    return Response.json(detail);
  } catch (error) {
    console.error("Delete payroll item error:", error);
    return Response.json({ error: "Gagal menghapus item." }, { status: 500 });
  }
}
