import type { Metadata } from "next";
import { VisitReportManager } from "@/features/visits/components/visit-report-manager";
import { visitReports } from "@/features/visits/server/visit-service";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan Kunjungan" };

type Props = {
  searchParams: Promise<{
    period?: string;
    week?: string;
    month?: string;
    year?: string;
    date?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const context = await requireCompany();
  const params = await searchParams;

  const today = dateInTimeZone(context.timezone);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const currentYear = todayDate.getUTCFullYear();
  const currentMonth = todayDate.getUTCMonth() + 1; // 1-12
  const currentDay = todayDate.getUTCDate();
  const currentWeek = currentDay <= 7 ? 1 : currentDay <= 14 ? 2 : currentDay <= 21 ? 3 : 4;

  const period = (["day", "week", "month"].includes(params.period ?? "")
    ? params.period
    : "week") as "day" | "week" | "month";

  const week = params.week ? Math.min(4, Math.max(1, parseInt(params.week, 10))) : currentWeek;
  const month = params.month ? Math.min(12, Math.max(1, parseInt(params.month, 10))) : currentMonth;
  const year = params.year ? parseInt(params.year, 10) : currentYear;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;

  let from = "";
  let to = "";

  if (period === "week") {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (week === 1) {
      from = `${year}-${String(month).padStart(2, "0")}-01`;
      to = `${year}-${String(month).padStart(2, "0")}-07`;
    } else if (week === 2) {
      from = `${year}-${String(month).padStart(2, "0")}-08`;
      to = `${year}-${String(month).padStart(2, "0")}-14`;
    } else if (week === 3) {
      from = `${year}-${String(month).padStart(2, "0")}-15`;
      to = `${year}-${String(month).padStart(2, "0")}-21`;
    } else {
      from = `${year}-${String(month).padStart(2, "0")}-22`;
      to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    }
  } else if (period === "month") {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    from = `${year}-${String(month).padStart(2, "0")}-01`;
    to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  } else {
    from = date;
    to = date;
  }

  const rows = await visitReports(context.companyId, from, to);

  return (
    <VisitReportManager
      rows={rows}
      initialPeriod={period}
      initialWeek={week}
      initialMonth={month}
      initialYear={year}
      initialDate={date}
      from={from}
      to={to}
    />
  );
}
