import ExcelJS from "exceljs";
import { basisLabels, formatDuration, type Payslip, type PayslipLine } from "./payslip-calculation";
import { formatPeriodRange } from "@/features/payslips/payroll-period";

export const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const MONEY = '"Rp" #,##0;-"Rp" #,##0';
const BRAND = "FFFAA30E", INK = "FF26221E", CREAM = "FFFBF6EC", LINE = "FFE6DED1", MUTED = "FF7A7268";
const thin = { style: "thin" as const, color: { argb: LINE } };

/** Totals of a set of slips, for the "Total Keseluruhan" block / row. */
export function payslipTotals(slips: Payslip[]) {
  return slips.reduce((sum, slip) => ({
    gross: sum.gross + slip.grossPay,
    deductions: sum.deductions + slip.totalDeductions,
    net: sum.net + slip.netPay,
  }), { gross: 0, deductions: 0, net: 0 });
}

/** "2 hari", "1 jam 30 menit" — the quantity of a slip line as people read it. */
export function lineQuantity(line: PayslipLine) {
  return line.unit === "jam" ? formatDuration(line.quantity) : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(line.quantity)} ${line.unit}`;
}

function fill(cell: ExcelJS.Cell | ExcelJS.Row, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/**
 * One workbook with every employee's payslip of a month:
 * - "Rincian Slip": each employee's slip itemized (earnings, deductions, net), then the grand total below;
 * - "Rekap": one row per employee with the attendance summary and amounts, totals on the last row.
 */
export async function buildPayslipWorkbook(slips: Payslip[], companyName: string, year: number, month: number, range: { start: string; end: string }) {
  const period = `${monthNames[month - 1]} ${year} (${formatPeriodRange(range.start, range.end)})`;
  const totals = payslipTotals(slips);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TepatWaktu";
  workbook.created = new Date();

  // ---------- Rincian per karyawan ----------
  const detail = workbook.addWorksheet("Rincian Slip", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  detail.columns = [{ width: 6 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 20 }];
  detail.properties.defaultRowHeight = 18;

  const title = detail.addRow([`Slip Gaji Karyawan — ${companyName}`]);
  title.font = { name: "Arial", size: 15, bold: true, color: { argb: INK } };
  detail.mergeCells(title.number, 1, title.number, 5);
  const sub = detail.addRow([`Periode ${period} · ${slips.length} karyawan`]);
  sub.font = { name: "Arial", size: 10, color: { argb: MUTED } };
  detail.mergeCells(sub.number, 1, sub.number, 5);
  detail.addRow([]);

  slips.forEach((slip, index) => {
    const { employee, summary } = slip;
    const head = detail.addRow([`${index + 1}. ${employee.name}`, "", "", "", slip.status === "final" ? "Terkunci" : "Draft"]);
    detail.mergeCells(head.number, 1, head.number, 4);
    head.height = 22;
    head.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    fill(head.getCell(1), BRAND); fill(head.getCell(5), BRAND);
    head.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    head.getCell(1).alignment = { vertical: "middle" };

    const info = detail.addRow([`NIK ${employee.employeeCode || "—"} · ${employee.position || "—"} · ${employee.department || "—"} · Basis ${basisLabels[slip.basis]} ${new Intl.NumberFormat("id-ID").format(slip.baseRate)}`]);
    detail.mergeCells(info.number, 1, info.number, 5);
    info.font = { name: "Arial", size: 9.5, color: { argb: MUTED } };
    const attendance = [
      `Hari kerja ${summary.workingDays}`, `Hadir ${summary.daysWorked}`,
      summary.lateDays ? `Terlambat ${summary.lateDays}x${summary.lateMinutes ? ` (${formatDuration(summary.lateMinutes / 60)})` : ""}` : "",
      `Izin dibayar ${summary.paidLeaveDays}`, `Izin tidak dibayar ${summary.unpaidLeaveDays}`, `Alpa ${summary.absentDays}`,
      slip.basis === "hourly" ? `Jam kerja ${formatDuration(summary.workedHours)}` : summary.overtimeHours ? `Lembur ${formatDuration(summary.overtimeHours)}` : "",
    ].filter(Boolean).join(" · ");
    const att = detail.addRow([attendance]);
    detail.mergeCells(att.number, 1, att.number, 5);
    att.font = { name: "Arial", size: 9.5, color: { argb: MUTED } };

    const columns = detail.addRow(["", "Komponen", "Jumlah", "Tarif", "Nominal"]);
    columns.font = { name: "Arial", size: 9.5, bold: true, color: { argb: INK } };
    for (let c = 1; c <= 5; c++) { fill(columns.getCell(c), CREAM); columns.getCell(c).border = { bottom: thin }; }
    for (const c of [3, 4, 5]) columns.getCell(c).alignment = { horizontal: "right" };

    const section = (label: string, lines: PayslipLine[], total: number, sign: 1 | -1) => {
      const labelRow = detail.addRow([label]);
      labelRow.font = { name: "Arial", size: 10, bold: true, color: { argb: INK } };
      if (!lines.length) {
        const none = detail.addRow(["", `Tidak ada ${label.toLowerCase()}`]);
        none.font = { name: "Arial", size: 9.5, italic: true, color: { argb: MUTED } };
      }
      for (const line of lines) {
        const row = detail.addRow(["", line.name, lineQuantity(line), line.rate, sign * line.amount]);
        row.font = { name: "Arial", size: 10 };
        row.getCell(3).alignment = { horizontal: "right" };
        row.getCell(4).numFmt = MONEY; row.getCell(5).numFmt = MONEY;
      }
      const sum = detail.addRow(["", `Total ${label.toLowerCase()}`, "", "", sign * total]);
      sum.font = { name: "Arial", size: 10, bold: true };
      sum.getCell(5).numFmt = MONEY;
      for (let c = 2; c <= 5; c++) sum.getCell(c).border = { top: thin };
    };
    section("Pendapatan", slip.earnings, slip.grossPay, 1);
    section("Potongan", slip.deductions, slip.totalDeductions, -1);

    const net = detail.addRow(["", "Gaji Bersih Diterima", "", "", slip.netPay]);
    net.font = { name: "Arial", size: 11, bold: true, color: { argb: INK } };
    net.getCell(5).numFmt = MONEY;
    for (let c = 2; c <= 5; c++) fill(net.getCell(c), CREAM);
    detail.addRow([]);
  });

  // Grand total below every slip.
  const grand = detail.addRow(["TOTAL KESELURUHAN", "", "", "", ""]);
  detail.mergeCells(grand.number, 1, grand.number, 5);
  grand.height = 24;
  grand.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  grand.getCell(1).alignment = { vertical: "middle" };
  fill(grand.getCell(1), INK);
  const totalLine = (label: string, value: number | string, strong = false) => {
    const row = detail.addRow(["", label, "", "", value]);
    row.font = { name: "Arial", size: strong ? 12 : 10.5, bold: true, color: { argb: INK } };
    if (typeof value === "number") row.getCell(5).numFmt = MONEY;
    else row.getCell(5).alignment = { horizontal: "right" };
    for (let c = 2; c <= 5; c++) row.getCell(c).border = { bottom: thin };
    if (strong) for (let c = 2; c <= 5; c++) fill(row.getCell(c), CREAM);
  };
  totalLine("Jumlah karyawan", `${slips.length} orang`);
  totalLine("Total pendapatan", totals.gross);
  totalLine("Total potongan", -totals.deductions);
  totalLine("Total gaji bersih dibayarkan", totals.net, true);

  // ---------- Rekap satu baris per karyawan ----------
  const recap = workbook.addWorksheet("Rekap", { views: [{ state: "frozen", ySplit: 3 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const headers = ["No", "NIK", "Nama", "Divisi", "Jabatan", "Basis Gaji", "Tarif Dasar", "Hari Kerja", "Hadir", "Terlambat (x)", "Alpa", "Izin Dibayar", "Izin Tdk Dibayar", "Lembur / Jam Kerja", "Pendapatan", "Potongan", "Gaji Bersih", "Status"];
  recap.columns = [6, 14, 26, 18, 18, 12, 16, 10, 8, 12, 8, 12, 15, 18, 18, 16, 18, 11].map((width) => ({ width }));
  const recapTitle = recap.addRow([`Rekap Gaji Karyawan — ${companyName} — Periode ${period}`]);
  recapTitle.font = { name: "Arial", size: 13, bold: true, color: { argb: INK } };
  recap.mergeCells(1, 1, 1, headers.length);
  recap.addRow([]);
  const header = recap.addRow(headers);
  header.height = 24;
  header.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= headers.length; c++) fill(header.getCell(c), BRAND);

  const first = recap.rowCount + 1;
  slips.forEach((slip, index) => {
    const { summary } = slip;
    const row = recap.addRow([
      index + 1, slip.employee.employeeCode, slip.employee.name, slip.employee.department, slip.employee.position,
      basisLabels[slip.basis], slip.baseRate, summary.workingDays, summary.daysWorked, summary.lateDays, summary.absentDays,
      summary.paidLeaveDays, summary.unpaidLeaveDays, formatDuration(slip.basis === "hourly" ? summary.workedHours : summary.overtimeHours),
      slip.grossPay, slip.totalDeductions, slip.netPay, slip.status === "final" ? "Terkunci" : "Draft",
    ]);
    row.font = { name: "Arial", size: 10 };
    for (const c of [7, 15, 16, 17]) row.getCell(c).numFmt = MONEY;
    for (let c = 1; c <= headers.length; c++) row.getCell(c).border = { bottom: thin };
  });
  const last = recap.rowCount;
  const sumOf = (column: string, result: number) => slips.length ? { formula: `SUM(${column}${first}:${column}${last})`, result } : 0;
  const totalRow = recap.addRow([
    "", "", "TOTAL", "", "", "", "", "", "", "", "", "", "", "",
    sumOf("O", totals.gross), sumOf("P", totals.deductions), sumOf("Q", totals.net), `${slips.length} orang`,
  ]);
  totalRow.height = 22;
  totalRow.font = { name: "Arial", size: 10.5, bold: true, color: { argb: INK } };
  for (let c = 1; c <= headers.length; c++) { fill(totalRow.getCell(c), CREAM); totalRow.getCell(c).border = { top: { style: "medium", color: { argb: INK } } }; }
  for (const c of [15, 16, 17]) totalRow.getCell(c).numFmt = MONEY;

  return workbook.xlsx.writeBuffer();
}
