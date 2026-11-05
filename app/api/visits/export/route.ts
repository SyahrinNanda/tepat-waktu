import { featureContext } from "@/features/generic-modules/server/feature-records";
import { exportVisitWorkbook, visitScope } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await featureContext(request, "kunjungan", "read");
    if ("error" in context) return context.error;
    const params = new URL(request.url).searchParams;
    // Staff only export their own visits, like the visit list.
    const scope = await visitScope(context);
    if (!scope) return Response.json({ error: "Akun belum terhubung ke data karyawan aktif." }, { status: 403 });
    const bytes = await exportVisitWorkbook(
      context.companyId,
      params.get("from") || undefined,
      params.get("to") || undefined,
      scope.employeeId,
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
    return Response.json({ error: "Gagal mengunduh data kunjungan." }, { status: 500 });
  }
}
