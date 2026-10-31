import { exportFinancialReports } from "@/features/finance/server/spreadsheet-handlers";

export async function GET(request: Request) {
  try {
    return await exportFinancialReports(request);
  } catch (error) {
    console.error("Financial report export failed", error);
    return Response.json({ error: "File export gagal dibuat." }, { status: 500 });
  }
}
