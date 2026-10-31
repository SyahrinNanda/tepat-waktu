import { featureContext } from "@/features/generic-modules/server/feature-records";
import { exportVisitWorkbook } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await featureContext(request, "kunjungan", "read");
    if ("error" in context) return context.error;
    const params = new URL(request.url).searchParams;
    const bytes = await exportVisitWorkbook(
      context.companyId,
      params.get("from") || undefined,
      params.get("to") || undefined,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="laporan-kunjungan.xlsx"',
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("VISIT EXPORT ERROR:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
