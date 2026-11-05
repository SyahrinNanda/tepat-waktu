import ExcelJS from "exceljs";
import { requireSuperAdmin } from "@/lib/superadmin";
import { durationLabel } from "../plan-rules";
import { getRevenueReport } from "./revenue-report";

const RUPIAH = '"Rp" #,##0';
const statusLabel = { verified: "Terverifikasi", awaiting_payment: "Menunggu pembayaran", awaiting_verification: "Menunggu verifikasi" } as const;

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF3A2200" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAA30E" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/** Superadmin revenue workbook: monthly summary, per plan, per method, and every transaction. */
export async function GET() {
  await requireSuperAdmin();
  const report = await getRevenueReport();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TepatWaktu";
  workbook.created = new Date();

  const monthly = workbook.addWorksheet("Per Bulan");
  monthly.columns = [{ header: "Bulan", key: "label", width: 14 }, { header: "Transaksi", key: "count", width: 12 }, { header: "Pendapatan", key: "revenue", width: 18, style: { numFmt: RUPIAH } }];
  report.months.forEach((month) => monthly.addRow(month));
  monthly.addRow({ label: "Total", count: report.count, revenue: report.total }).font = { bold: true };
  styleHeader(monthly);

  for (const [name, rows] of [["Per Paket", report.byPlan], ["Per Metode Bayar", report.byMethod]] as const) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [{ header: name === "Per Paket" ? "Paket" : "Metode", key: "label", width: 24 }, { header: "Transaksi", key: "count", width: 12 }, { header: "Pendapatan", key: "revenue", width: 18, style: { numFmt: RUPIAH } }, { header: "Porsi", key: "share", width: 10, style: { numFmt: "0%" } }];
    rows.forEach((row) => sheet.addRow({ ...row, share: report.total ? row.revenue / report.total : 0 }));
    styleHeader(sheet);
  }

  const transactions = workbook.addWorksheet("Transaksi");
  transactions.columns = [
    { header: "Invoice", key: "invoiceNumber", width: 26 }, { header: "Perusahaan", key: "company", width: 28 }, { header: "Paket", key: "plan", width: 16 },
    { header: "Durasi", key: "duration", width: 10 }, { header: "Jenis", key: "type", width: 10 }, { header: "Metode", key: "method", width: 20 },
    { header: "Status", key: "status", width: 22 }, { header: "Dibuat", key: "createdAt", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Diverifikasi", key: "verifiedAt", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Pendapatan", key: "revenue", width: 16, style: { numFmt: RUPIAH } }, { header: "Biaya Admin", key: "adminFee", width: 14, style: { numFmt: RUPIAH } },
    { header: "Total Dibayar", key: "amount", width: 16, style: { numFmt: RUPIAH } },
  ];
  report.transactions.forEach((row) => transactions.addRow({ ...row, duration: durationLabel(row), status: statusLabel[row.status], verifiedAt: row.verifiedAt ?? "" }));
  styleHeader(transactions);

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="pendapatan-tepatwaktu-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
