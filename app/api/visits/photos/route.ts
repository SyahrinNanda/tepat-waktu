import { featureContext } from "@/features/generic-modules/server/feature-records";
import { exportVisitPhotos } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await featureContext(request, "kunjungan", "read");
    if ("error" in context) return context.error;
    const params = new URL(request.url).searchParams;
    const bytes = await exportVisitPhotos(
      context.companyId,
      params.get("from") || undefined,
      params.get("to") || undefined,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="foto-lampiran-kunjungan.zip"',
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("VISIT PHOTOS EXPORT ERROR:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
