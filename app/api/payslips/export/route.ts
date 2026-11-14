import { requireCompanyRole } from "@/lib/current-company";
import { matchesPayslipQuery, payslipPeriod } from "@/features/payslips/payslip-query";
import { buildPayslipWorkbook, monthNames } from "@/features/payslips/server/payslip-export";
import { listPayslips } from "@/features/payslips/server/payslip-service";
import { getPayrollRules } from "@/features/payslips/server/payroll-settings";
import { payrollPeriod } from "@/features/payslips/payroll-period";

export const runtime = "nodejs";

/** Every employee's payslip of one month in one Excel file (itemized per employee + grand total + recap). */
export async function GET(request: Request) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  try {
    const params = new URL(request.url).searchParams;
    const { periodStartDay } = await getPayrollRules(context.companyId);
    const { year, month } = payslipPeriod({ year: params.get("year"), month: params.get("month") }, context.timezone, periodStartDay);
    const query = params.get("q") ?? "";
    const slips = (await listPayslips(context.companyId, year, month)).filter((slip) => matchesPayslipQuery(slip, query));
    const { start, end } = payrollPeriod(year, month, periodStartDay);
    const bytes = await buildPayslipWorkbook(slips, context.companyName, year, month, { start, end });
    const fileName = `slip-gaji-${monthNames[month - 1].toLowerCase()}-${year}.xlsx`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("PAYSLIP EXPORT ERROR:", error);
    return Response.json({ error: "Gagal mengunduh slip gaji." }, { status: 500 });
  }
}
