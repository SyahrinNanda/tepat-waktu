import { featureContext } from "@/features/generic-modules/server/feature-records";
import { exportVisitPhotos, visitScope } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await featureContext(request, "kunjungan", "read");
    if ("error" in context) return context.error;
    const params = new URL(request.url).searchParams;
    // Staff only export their own visits, like the visit list.
    const scope = await visitScope(context);
    if (!scope) return Response.json({ error: "Akun belum terhubung ke data karyawan aktif." }, { status: 403 });
    const bytes = await exportVisitPhotos(
      context.companyId,
      params.get("from") || undefined,
      params.get("to") || undefined,
      scope.employeeId,
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
    return Response.json({ error: "Gagal mengunduh data kunjungan." }, { status: 500 });
  }
}
