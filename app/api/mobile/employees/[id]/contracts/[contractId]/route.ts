import { deleteContractFor, extendContractFor, saveContractFor } from "@/features/employees/server/contract-service";
import { mobileFailure, mobileHrContext, uuidParam } from "@/features/employees/server/mobile-hr-context";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; contractId: string }> };

/** PATCH: `{ extendMonths }` extends the contract; any other body replaces its fields. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id, contractId } = await params;
    if (!uuidParam(id) || !uuidParam(contractId)) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const result = body && typeof body === "object" && "extendMonths" in body
      ? await extendContractFor(context.companyId, id, contractId, Number(body.extendMonths))
      : await saveContractFor(context.companyId, id, contractId, body);
    return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: 400 });
  } catch (error) { return mobileFailure(error, "Mobile contract update failed"); }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id, contractId } = await params;
    if (!uuidParam(id) || !uuidParam(contractId)) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const result = await deleteContractFor(context.companyId, id, contractId);
    return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: 404 });
  } catch (error) { return mobileFailure(error, "Mobile contract delete failed"); }
}
