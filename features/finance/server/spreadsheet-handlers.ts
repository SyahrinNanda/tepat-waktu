import ExcelJS from "exceljs";
import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { financialReports, financialTerms } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const headers = ["Tipe Finance", "Kategori Finance", "Jumlah Finance", "Deskripsi", "Tanggal Finance"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1_000;

export async function exportFinancialReports(request: Request) {
  const context = await featureContext(request, "perusahaan/laporan-keuangan", "read");
  if ("error" in context) return context.error;
  const rows = await db.select({ type: financialTerms.type, category: financialTerms.name, amount: financialReports.amount, description: financialReports.description, transactionDate: financialReports.transactionDate })
    .from(financialReports).innerJoin(financialTerms, eq(financialTerms.id, financialReports.financialTermId))
    .where(eq(financialReports.companyId, context.companyId)).orderBy(desc(financialReports.transactionDate), asc(financialTerms.name));
  const workbook = createWorkbook("Laporan Keuangan");
  const sheet = workbook.getWorksheet("Laporan Keuangan")!;
  sheet.columns = [
    { header: headers[0], key: "type", width: 18 }, { header: headers[1], key: "category", width: 28 },
    { header: headers[2], key: "amount", width: 20 }, { header: headers[3], key: "description", width: 42 },
    { header: headers[4], key: "transactionDate", width: 18 },
  ];
  for (const row of rows) sheet.addRow({ ...row, type: row.type === "income" ? "income" : "outcome", transactionDate: isoDate(row.transactionDate) });
  styleSheet(sheet, rows.length + 1);
  sheet.getColumn("amount").numFmt = 'Rp #,##0;[Red]-Rp #,##0;0';
  sheet.autoFilter = { from: "A1", to: "E1" };
  return workbookResponse(workbook, `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function financialReportTemplate(request: Request) {
  const context = await featureContext(request, "perusahaan/laporan-keuangan", "read");
  if ("error" in context) return context.error;
  const terms = await db.select({ name: financialTerms.name, type: financialTerms.type }).from(financialTerms).where(and(eq(financialTerms.companyId, context.companyId), eq(financialTerms.active, true))).orderBy(asc(financialTerms.name));
  const workbook = createWorkbook("Template Import");
  const sheet = workbook.getWorksheet("Template Import")!;
  sheet.columns = [
    { header: headers[0], key: "type", width: 18 }, { header: headers[1], key: "category", width: 28 },
    { header: headers[2], key: "amount", width: 20 }, { header: headers[3], key: "description", width: 42 }, { header: headers[4], key: "date", width: 18 },
  ];
  const example = terms[0];
  sheet.addRow({ type: example?.type ?? "income", category: example?.name ?? "Pendapatan Jasa", amount: 1500000, description: "Contoh transaksi — hapus baris ini sebelum import", date: new Date().toISOString().slice(0, 10) });
  styleSheet(sheet, 2);
  sheet.getColumn("amount").numFmt = 'Rp #,##0;[Red]-Rp #,##0;0';
  const guide = workbook.addWorksheet("Petunjuk");
  guide.columns = [{ width: 26 }, { width: 80 }];
  guide.addRows([
    ["Petunjuk", "Isi data pada sheet Template Import mulai baris 2. Hapus baris contoh sebelum mengimpor data sebenarnya."],
    ["Tipe Finance", "Gunakan income atau outcome."], ["Kategori Finance", "Harus sama persis dengan istilah keuangan aktif di TepatWaktu."],
    ["Jumlah Finance", "Angka bulat positif tanpa simbol mata uang."], ["Deskripsi", "Wajib diisi, maksimal 500 karakter."], ["Tanggal Finance", "Gunakan tanggal Excel atau format YYYY-MM-DD."],
  ]);
  guide.getRow(1).font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }; guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087BC5" } };
  guide.eachRow((row) => { row.font = { ...row.font, name: "Arial", size: 10 }; row.alignment = { vertical: "top", wrapText: true }; });
  return workbookResponse(workbook, "template-import-laporan-keuangan.xlsx");
}

export async function importFinancialReports(request: Request) {
  const context = await featureContext(request, "perusahaan/laporan-keuangan", "write");
  if ("error" in context) return context.error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Pilih file Excel terlebih dahulu." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "Ukuran file maksimal 5 MB." }, { status: 413 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "Format file harus .xlsx." }, { status: 400 });
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); } catch { return Response.json({ error: "File Excel rusak atau tidak dapat dibaca." }, { status: 400 }); }
  const sheet = workbook.worksheets[0];
  if (!sheet) return Response.json({ error: "Workbook tidak memiliki worksheet." }, { status: 400 });
  const actualHeaders = Array.from({ length: 5 }, (_, index) => cellText(sheet.getRow(1).getCell(index + 1)));
  if (headers.some((header, index) => actualHeaders[index] !== header)) return Response.json({ error: `Header wajib: ${headers.join(", ")}.` }, { status: 400 });
  if (sheet.actualRowCount - 1 > MAX_ROWS) return Response.json({ error: `Maksimal ${MAX_ROWS} baris per import.` }, { status: 400 });
  const terms = await db.select({ id: financialTerms.id, name: financialTerms.name, type: financialTerms.type }).from(financialTerms).where(and(eq(financialTerms.companyId, context.companyId), eq(financialTerms.active, true)));
  const termMap = new Map(terms.map((term) => [`${term.type}|${term.name.toLocaleLowerCase("id-ID")}`, term.id]));
  const values: { companyId: string; financialTermId: string; amount: number; description: string; transactionDate: string; createdBy: string }[] = [];
  const errors: string[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber), cells = Array.from({ length: 5 }, (_, index) => row.getCell(index + 1));
    if (cells.every((cell) => cellText(cell) === "")) continue;
    const type = normalizeType(cellText(cells[0])), category = cellText(cells[1]), amount = parseAmount(cells[2].value), description = cellText(cells[3]), transactionDate = parseDate(cells[4].value);
    const termId = type ? termMap.get(`${type}|${category.toLocaleLowerCase("id-ID")}`) : undefined;
    if (!type) errors.push(`Baris ${rowNumber}: tipe harus income atau outcome.`);
    else if (!termId) errors.push(`Baris ${rowNumber}: kategori “${category || "-"}” tidak aktif atau tidak sesuai tipe.`);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000_000) errors.push(`Baris ${rowNumber}: jumlah tidak valid.`);
    if (description.length < 2 || description.length > 500) errors.push(`Baris ${rowNumber}: deskripsi wajib 2–500 karakter.`);
    if (!transactionDate) errors.push(`Baris ${rowNumber}: tanggal tidak valid.`);
    if (type && termId && Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_000 && description.length >= 2 && description.length <= 500 && transactionDate) values.push({ companyId: context.companyId, financialTermId: termId, amount, description, transactionDate, createdBy: context.userId });
  }
  if (errors.length) return Response.json({ error: "Data import belum valid.", details: errors.slice(0, 20) }, { status: 400 });
  if (!values.length) return Response.json({ error: "Tidak ada baris data untuk diimpor." }, { status: 400 });
  await db.transaction(async (tx) => { await tx.insert(financialReports).values(values); });
  revalidatePath("/dashboard/perusahaan/laporan-keuangan");
  return Response.json({ ok: true, count: values.length });
}

function createWorkbook(sheetName: string) { const workbook = new ExcelJS.Workbook(); workbook.creator = "TepatWaktu"; workbook.company = "TepatWaktu"; workbook.created = new Date(); workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] }); return workbook; }
function styleSheet(sheet: ExcelJS.Worksheet, rowCount: number) { const header = sheet.getRow(1); header.height = 24; header.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087BC5" } }; header.alignment = { vertical: "middle" }; for (let index = 2; index <= rowCount; index++) { const row = sheet.getRow(index); row.font = { name: "Arial", size: 10 }; row.alignment = { vertical: "middle", wrapText: true }; } }
async function workbookResponse(workbook: ExcelJS.Workbook, filename: string) { const buffer = await workbook.xlsx.writeBuffer(); return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } }); }
function cellText(cell: ExcelJS.Cell) { return String(cell.text ?? "").trim(); }
function normalizeType(value: string): "income" | "outcome" | null { const normalized = value.toLowerCase(); if (["income", "pemasukan", "pendapatan"].includes(normalized)) return "income"; if (["outcome", "pengeluaran"].includes(normalized)) return "outcome"; return null; }
function parseAmount(value: ExcelJS.CellValue) { if (typeof value === "number") return Math.trunc(value); return Number(String(value ?? "").replace(/[^0-9-]/g, "")); }
function parseDate(value: ExcelJS.CellValue) { if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDate(value); const text = String(value ?? "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return text; return null; }
function isoDate(value: string | Date) { const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value; return date.toISOString().slice(0, 10); }
