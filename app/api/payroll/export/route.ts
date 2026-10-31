import { featureContext } from "@/features/generic-modules/server/feature-records";
import { exportPayrollsToExcel } from "@/features/payroll/server/payroll-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await featureContext(request, "payroll", "read");
  if ("error" in context) return context.error;

  const url = new URL(request.url);
  const month = url.searchParams.get("month")
    ? Number(url.searchParams.get("month"))
    : undefined;
  const year = url.searchParams.get("year")
    ? Number(url.searchParams.get("year"))
    : undefined;
  const status = url.searchParams.get("status") || undefined;

  try {
    const bytes = await exportPayrollsToExcel(context.companyId, {
      month,
      year,
      status,
    });

    const filename = `Laporan-Payroll-${year || "semua"}-${month ? String(month).padStart(2, "0") : "semua"}.xlsx`;

    return new Response(bytes as BodyInit, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export payroll error:", error);
    return Response.json(
      { error: "Gagal mengekspor laporan payroll." },
      { status: 500 },
    );
  }
}
