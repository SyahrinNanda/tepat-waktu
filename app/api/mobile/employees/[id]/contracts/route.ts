import { listContracts, saveContractFor } from "@/features/employees/server/contract-service";
import { mobileFailure, mobileHrContext, uuidParam } from "@/features/employees/server/mobile-hr-context";
import { CONTRACT_TYPES, contractEndDate } from "@/features/employees/contracts";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/** GET: the employee's contracts (newest active first) with their computed end date. */
export async function GET(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id } = await params;
    if (!uuidParam(id)) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const rows = await listContracts(context.companyId, id);
    return Response.json({ rows: rows.map((row) => ({ ...row, endDate: contractEndDate(row.startDate, row.durationMonths) })), types: CONTRACT_TYPES });
  } catch (error) { return mobileFailure(error, "Mobile contracts list failed"); }
}

/** POST: adds a contract. */
export async function POST(request: Request, { params }: Params) {
  try {
    const context = await mobileHrContext(request);
    const { id } = await params;
    if (!uuidParam(id)) return Response.json({ error: "ID karyawan tidak valid." }, { status: 400 });
    const result = await saveContractFor(context.companyId, id, null, await request.json().catch(() => ({})));
    return result.ok ? Response.json({ ok: true }, { status: 201 }) : Response.json({ error: result.error }, { status: 400 });
  } catch (error) { return mobileFailure(error, "Mobile contract create failed"); }
}
