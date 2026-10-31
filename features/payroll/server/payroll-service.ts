import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  employeeSalaryProfiles,
  employees,
  fileAssets,
  payrollItems,
  payrolls,
} from "@/db/schema";
import { compressUpload } from "@/lib/file-compression";
import { putPrivateObject } from "@/lib/object-storage";
import type { PayrollItemRow, PayrollRow } from "@/features/payroll/types";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export async function listPayrolls(
  companyId: string,
  filters?: {
    query?: string;
    month?: number;
    year?: number;
    status?: string;
  },
): Promise<PayrollRow[]> {
  const conditions = [eq(payrolls.companyId, companyId)];

  if (filters?.query?.trim()) {
    const term = `%${filters.query.trim()}%`;
    conditions.push(
      or(
        like(employees.name, term),
        like(employees.employeeCode, term),
      )!,
    );
  }

  if (filters?.month && filters.month > 0) {
    conditions.push(eq(payrolls.month, filters.month));
  }

  if (filters?.year && filters.year > 0) {
    conditions.push(eq(payrolls.year, filters.year));
  }

  if (filters?.status && filters.status !== "Pilih Status" && filters.status.trim() !== "") {
    conditions.push(eq(payrolls.status, filters.status));
  }

  const rows = await db
    .select({
      id: payrolls.id,
      employeeId: payrolls.employeeId,
      employeeName: employees.name,
      employeeCode: employees.employeeCode,
      month: payrolls.month,
      year: payrolls.year,
      salaryType: payrolls.salaryType,
      quantity: payrolls.quantity,
      rate: payrolls.rate,
      compensationAmount: payrolls.compensationAmount,
      deductionAmount: payrolls.deductionAmount,
      totalAmount: payrolls.totalAmount,
      status: payrolls.status,
      slipAssetId: payrolls.slipAssetId,
      slipOriginalName: fileAssets.originalName,
      createdAt: sql<string>`to_char(${payrolls.createdAt}, 'YYYY-MM-DD HH24:MI:SS')`,
    })
    .from(payrolls)
    .innerJoin(employees, eq(payrolls.employeeId, employees.id))
    .leftJoin(fileAssets, eq(payrolls.slipAssetId, fileAssets.id))
    .where(and(...conditions))
    .orderBy(desc(payrolls.createdAt));

  return rows as PayrollRow[];
}

export async function getPayrollById(
  companyId: string,
  payrollId: string,
): Promise<{ payroll: PayrollRow; items: PayrollItemRow[] } | null> {
  const [row] = await db
    .select({
      id: payrolls.id,
      employeeId: payrolls.employeeId,
      employeeName: employees.name,
      employeeCode: employees.employeeCode,
      month: payrolls.month,
      year: payrolls.year,
      salaryType: payrolls.salaryType,
      quantity: payrolls.quantity,
      rate: payrolls.rate,
      compensationAmount: payrolls.compensationAmount,
      deductionAmount: payrolls.deductionAmount,
      totalAmount: payrolls.totalAmount,
      status: payrolls.status,
      slipAssetId: payrolls.slipAssetId,
      slipOriginalName: fileAssets.originalName,
      createdAt: sql<string>`to_char(${payrolls.createdAt}, 'YYYY-MM-DD HH24:MI:SS')`,
    })
    .from(payrolls)
    .innerJoin(employees, eq(payrolls.employeeId, employees.id))
    .leftJoin(fileAssets, eq(payrolls.slipAssetId, fileAssets.id))
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.companyId, companyId)))
    .limit(1);

  if (!row) return null;

  const items = (await db
    .select({
      id: payrollItems.id,
      payrollId: payrollItems.payrollId,
      category: payrollItems.category,
      name: payrollItems.name,
      rate: payrollItems.rate,
      quantity: payrollItems.quantity,
      salaryType: payrollItems.salaryType,
      totalAmount: payrollItems.totalAmount,
    })
    .from(payrollItems)
    .where(and(eq(payrollItems.payrollId, payrollId), eq(payrollItems.companyId, companyId)))
    .orderBy(payrollItems.createdAt)) as PayrollItemRow[];

  return { payroll: row as PayrollRow, items };
}

export async function createPayroll(
  companyId: string,
  userId: string,
  input: {
    employeeId: string;
    month: number;
    year: number;
    salaryType: string;
    quantity: number;
    rate: number;
    slipFile?: File | null;
  },
) {
  const [employee] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.companyId, companyId),
        eq(employees.status, "active"),
      ),
    )
    .limit(1);

  if (!employee) {
    throw new Error("Karyawan aktif tidak ditemukan.");
  }

  const baseAmount = Math.round(input.quantity * input.rate);
  let slipAssetId: string | null = null;

  if (input.slipFile && input.slipFile.size > 0) {
    slipAssetId = await uploadPayrollSlip({
      companyId,
      userId,
      employeeId: employee.id,
      file: input.slipFile,
    });
  }

  const [created] = await db
    .insert(payrolls)
    .values({
      companyId,
      employeeId: employee.id,
      month: input.month,
      year: input.year,
      salaryType: input.salaryType || "Bulan",
      quantity: input.quantity,
      rate: input.rate,
      compensationAmount: 0,
      deductionAmount: 0,
      totalAmount: baseAmount,
      status: "New",
      slipAssetId,
      createdBy: userId,
    })
    .returning();

  return created;
}

export async function updatePayroll(
  companyId: string,
  id: string,
  input: {
    status?: string;
    quantity?: number;
    rate?: number;
    salaryType?: string;
    month?: number;
    year?: number;
    slipFile?: File | null;
  },
) {
  const [existing] = await db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.id, id), eq(payrolls.companyId, companyId)))
    .limit(1);

  if (!existing) {
    throw new Error("Data payroll tidak ditemukan.");
  }

  let slipAssetId = existing.slipAssetId;
  if (input.slipFile && input.slipFile.size > 0) {
    slipAssetId = await uploadPayrollSlip({
      companyId,
      userId: existing.createdBy || "",
      employeeId: existing.employeeId,
      file: input.slipFile,
    });
  }

  const quantity = input.quantity ?? existing.quantity;
  const rate = input.rate ?? existing.rate;
  const baseSalary = Math.round(quantity * rate);
  const totalAmount = baseSalary + existing.compensationAmount - existing.deductionAmount;

  const [updated] = await db
    .update(payrolls)
    .set({
      status: input.status ?? existing.status,
      salaryType: input.salaryType ?? existing.salaryType,
      quantity,
      rate,
      totalAmount,
      month: input.month ?? existing.month,
      year: input.year ?? existing.year,
      slipAssetId,
      updatedAt: new Date(),
    })
    .where(and(eq(payrolls.id, id), eq(payrolls.companyId, companyId)))
    .returning();

  return updated;
}

export async function savePayrollItem(
  companyId: string,
  payrollId: string,
  input: {
    id?: string;
    category: "compensation" | "deduction";
    name: string;
    rate: number;
    quantity: number;
    salaryType?: string;
  },
) {
  const [payroll] = await db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.companyId, companyId)))
    .limit(1);

  if (!payroll) throw new Error("Payroll tidak ditemukan.");

  const itemTotal = Math.round(input.rate * input.quantity);

  if (input.id) {
    await db
      .update(payrollItems)
      .set({
        name: input.name,
        rate: input.rate,
        quantity: input.quantity,
        salaryType: input.salaryType || "bulan",
        totalAmount: itemTotal,
        updatedAt: new Date(),
      })
      .where(and(eq(payrollItems.id, input.id), eq(payrollItems.payrollId, payrollId)));
  } else {
    await db.insert(payrollItems).values({
      payrollId,
      companyId,
      category: input.category,
      name: input.name,
      rate: input.rate,
      quantity: input.quantity,
      salaryType: input.salaryType || "bulan",
      totalAmount: itemTotal,
    });
  }

  // Recalculate compensation and deduction totals
  await recalculatePayrollTotals(companyId, payrollId);

  return getPayrollById(companyId, payrollId);
}

export async function deletePayrollItem(
  companyId: string,
  payrollId: string,
  itemId: string,
) {
  await db
    .delete(payrollItems)
    .where(
      and(
        eq(payrollItems.id, itemId),
        eq(payrollItems.payrollId, payrollId),
        eq(payrollItems.companyId, companyId),
      ),
    );

  await recalculatePayrollTotals(companyId, payrollId);

  return getPayrollById(companyId, payrollId);
}

async function recalculatePayrollTotals(companyId: string, payrollId: string) {
  const items = await db
    .select({
      category: payrollItems.category,
      totalAmount: payrollItems.totalAmount,
    })
    .from(payrollItems)
    .where(and(eq(payrollItems.payrollId, payrollId), eq(payrollItems.companyId, companyId)));

  let compensationAmount = 0;
  let deductionAmount = 0;

  for (const item of items) {
    if (item.category === "compensation") {
      compensationAmount += item.totalAmount;
    } else if (item.category === "deduction") {
      deductionAmount += item.totalAmount;
    }
  }

  const [payroll] = await db
    .select({
      quantity: payrolls.quantity,
      rate: payrolls.rate,
    })
    .from(payrolls)
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.companyId, companyId)))
    .limit(1);

  if (!payroll) return;

  const baseSalary = Math.round(payroll.quantity * payroll.rate);
  const totalAmount = baseSalary + compensationAmount - deductionAmount;

  await db
    .update(payrolls)
    .set({
      compensationAmount,
      deductionAmount,
      totalAmount,
      updatedAt: new Date(),
    })
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.companyId, companyId)));
}

export async function deletePayroll(companyId: string, id: string) {
  const [deleted] = await db
    .delete(payrolls)
    .where(and(eq(payrolls.id, id), eq(payrolls.companyId, companyId)))
    .returning({ id: payrolls.id });

  return deleted;
}

export async function markAllPayrollsDone(
  companyId: string,
  filters?: { month?: number; year?: number },
) {
  const conditions = [
    eq(payrolls.companyId, companyId),
    or(eq(payrolls.status, "New"), eq(payrolls.status, "Pending"))!,
  ];
  if (filters?.month && filters.month > 0) {
    conditions.push(eq(payrolls.month, filters.month));
  }
  if (filters?.year && filters.year > 0) {
    conditions.push(eq(payrolls.year, filters.year));
  }

  const updated = await db
    .update(payrolls)
    .set({ status: "Done", updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: payrolls.id });

  return { count: updated.length };
}

export async function generatePayrolls(
  companyId: string,
  userId: string,
  month: number,
  year: number,
) {
  // 1. Get all active employees in this company
  const activeEmployees = await db
    .select({
      id: employees.id,
      name: employees.name,
    })
    .from(employees)
    .where(
      and(
        eq(employees.companyId, companyId),
        eq(employees.status, "active"),
      ),
    );

  if (!activeEmployees.length) {
    return { count: 0, message: "Tidak ada karyawan aktif untuk digenerate." };
  }

  // 2. Check which employees already have a payroll for this month and year
  const existingPayrolls = await db
    .select({
      employeeId: payrolls.employeeId,
    })
    .from(payrolls)
    .where(
      and(
        eq(payrolls.companyId, companyId),
        eq(payrolls.month, month),
        eq(payrolls.year, year),
      ),
    );

  const existingEmployeeIds = new Set(existingPayrolls.map((p) => p.employeeId));
  const employeesToGenerate = activeEmployees.filter(
    (emp) => !existingEmployeeIds.has(emp.id),
  );

  if (!employeesToGenerate.length) {
    return {
      count: 0,
      message: "Semua karyawan sudah memiliki daftar payroll untuk periode ini.",
    };
  }

  // 3. Fetch salary profiles if any
  const empIds = employeesToGenerate.map((e) => e.id);
  const profiles = await db
    .select({
      employeeId: employeeSalaryProfiles.employeeId,
      baseSalary: employeeSalaryProfiles.baseSalary,
    })
    .from(employeeSalaryProfiles)
    .where(
      and(
        eq(employeeSalaryProfiles.companyId, companyId),
        inArray(employeeSalaryProfiles.employeeId, empIds),
      ),
    );

  const profileMap = new Map<string, number>();
  for (const p of profiles) {
    profileMap.set(p.employeeId, p.baseSalary);
  }

  // 4. Insert payrolls
  const toInsert = employeesToGenerate.map((emp) => {
    const rate = profileMap.get(emp.id) || 5000000;
    const quantity = 1;
    const totalAmount = rate * quantity;
    return {
      companyId,
      employeeId: emp.id,
      month,
      year,
      salaryType: "Bulan",
      quantity,
      rate,
      compensationAmount: 0,
      deductionAmount: 0,
      totalAmount,
      status: "New",
      createdBy: userId,
    };
  });

  await db.insert(payrolls).values(toInsert);

  return {
    count: toInsert.length,
    message: `Berhasil generate payroll untuk ${toInsert.length} karyawan.`,
  };
}

export async function exportPayrollsToExcel(
  companyId: string,
  filters?: {
    month?: number;
    year?: number;
    status?: string;
  },
): Promise<Uint8Array> {
  const rows = await listPayrolls(companyId, filters);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Payroll");

  // Header sesuai Gambar 3
  worksheet.columns = [
    { header: "Nama Karyawan", key: "nama", width: 22 },
    { header: "Periode", key: "periode", width: 16 },
    { header: "Tanggal", key: "tanggal", width: 14 },
    { header: "Waktu Kerja", key: "waktuKerja", width: 16 },
    { header: "Gaji", key: "gaji", width: 16 },
    { header: "Kompensasi", key: "kompensasi", width: 14 },
    { header: "Potongan", key: "potongan", width: 14 },
    { header: "Total", key: "total", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "", key: "colJ", width: 10 },
    { header: "", key: "colK", width: 10 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1E7145" }, // Dark green Excel theme matching Gambar 3
  };

  rows.forEach((row) => {
    const periode = `${MONTH_NAMES[row.month - 1] || row.month} ${row.year}`;
    const tanggal = row.createdAt.slice(0, 10);
    const waktuKerja = `${row.quantity} ${row.salaryType.toLowerCase()}`;
    const baseGaji = row.rate * row.quantity;
    const kompensasi = row.compensationAmount > 0 ? row.compensationAmount : "-";
    const potongan = row.deductionAmount > 0 ? row.deductionAmount : "-";

    worksheet.addRow({
      nama: row.employeeName,
      periode,
      tanggal,
      waktuKerja,
      gaji: baseGaji,
      kompensasi,
      potongan,
      total: row.totalAmount,
      status: row.status.toLowerCase(),
      colJ: row.salaryType.toLowerCase(),
      colK: row.year,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

async function uploadPayrollSlip(input: {
  companyId: string;
  userId: string;
  employeeId: string;
  file: File;
}): Promise<string> {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const format = detectFormat(bytes);
  if (!format) {
    throw new Error("Format file harus PDF, JPEG, atau PNG.");
  }

  const compressed = await compressUpload(bytes, format.contentType);
  const checksum = createHash("sha256").update(compressed.bytes).digest("hex");
  const key = `companies/${input.companyId}/payrolls/${randomUUID()}.${format.extension}`;

  const stored = await putPrivateObject({
    key,
    body: compressed.bytes,
    contentType: format.contentType,
    storageCompression: compressed.storageCompression,
    metadata: {
      company: input.companyId,
      module: "payroll",
      sha256: checksum,
    },
  });

  const [asset] = await db
    .insert(fileAssets)
    .values({
      companyId: input.companyId,
      ownerEmployeeId: input.employeeId,
      uploadedBy: input.userId,
      category: "payslip",
      bucket: stored.bucket,
      objectKey: stored.key,
      originalName: input.file.name || `slip.${format.extension}`,
      contentType: format.contentType,
      byteSize: compressed.bytes.byteLength,
      checksumSha256: checksum,
    })
    .returning({ id: fileAssets.id });

  return asset.id;
}

function detectFormat(bytes: Uint8Array) {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  return null;
}
