import ExcelJS from "exceljs";
import { and, asc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  attendances,
  employees,
  workSchedules,
} from "@/db/schema";
import { attendanceManagerContext } from "@/features/attendance/server/attendance-service";

import {
  formatMinutesExcel,
  MonthlyEmployeeSummary,
  parseTimeToMinutes,
} from "@/features/attendance/types/monthly";

export async function fetchMonthlyAttendanceSummary({
  companyId,
  year,
  month,
  query,
  locationId,
  division,
  shiftId,
}: {
  companyId: string;
  year: number;
  month: number;
  query?: string;
  locationId?: string;
  division?: string;
  shiftId?: string;
}): Promise<MonthlyEmployeeSummary[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // 1. Fetch active employees
  const employeeConditions = [
    eq(employees.companyId, companyId),
    eq(employees.status, "active"),
  ];

  if (division) {
    employeeConditions.push(eq(employees.department, division));
  }

  if (query) {
    employeeConditions.push(
      or(ilike(employees.name, `%${query}%`), ilike(employees.employeeCode, `%${query}%`))!
    );
  }

  const employeeRows = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeCode: employees.employeeCode,
      department: employees.department,
    })
    .from(employees)
    .where(and(...employeeConditions))
    .orderBy(asc(employees.name));

  if (employeeRows.length === 0) return [];

  // 2. Fetch all shifts for the company to calculate standard working hours
  const shiftRows = await db
    .select({
      id: workSchedules.id,
      name: workSchedules.name,
      startTime: workSchedules.startTime,
      endTime: workSchedules.endTime,
    })
    .from(workSchedules)
    .where(eq(workSchedules.companyId, companyId));

  const shiftMap = new Map<string, { name: string; start: number; end: number; duration: number }>();
  for (const s of shiftRows) {
    const startM = parseTimeToMinutes(s.startTime) ?? 8 * 60;
    const endM = parseTimeToMinutes(s.endTime) ?? 17 * 60;
    const duration = Math.max(0, endM - startM - 60); // standard 8 hours minus 1 hour break
    shiftMap.set(s.id, { name: s.name, start: startM, end: endM, duration });
  }

  // 3. Fetch attendances in date range
  const attendanceConditions = [
    eq(attendances.companyId, companyId),
    gte(attendances.attendanceDate, startDate),
    lte(attendances.attendanceDate, endDate),
  ];

  if (shiftId) {
    attendanceConditions.push(eq(attendances.shiftId, shiftId));
  }

  if (locationId) {
    attendanceConditions.push(
      or(
        eq(attendances.checkInLocationId, locationId),
        eq(attendances.checkOutLocationId, locationId)
      )!
    );
  }

  const attendanceRecords = await db
    .select({
      id: attendances.id,
      employeeId: attendances.employeeId,
      attendanceDate: attendances.attendanceDate,
      shiftId: attendances.shiftId,
      checkIn: attendances.checkIn,
      checkOut: attendances.checkOut,
      breakStart: attendances.breakStart,
      breakEnd: attendances.breakEnd,
      status: attendances.status,
      checkInLocationId: attendances.checkInLocationId,
    })
    .from(attendances)
    .where(and(...attendanceConditions));

  // Group attendances by employeeId
  const attendanceMap = new Map<string, typeof attendanceRecords>();
  for (const record of attendanceRecords) {
    if (!attendanceMap.has(record.employeeId)) {
      attendanceMap.set(record.employeeId, []);
    }
    attendanceMap.get(record.employeeId)!.push(record);
  }

  const defaultShiftStart = 8 * 60; // 08:00
  const defaultShiftEnd = 17 * 60; // 17:00
  const defaultShiftDuration = 8 * 60; // 8 hours

  // 4. Calculate summaries per employee
  const summaries: MonthlyEmployeeSummary[] = [];

  for (const emp of employeeRows) {
    const records = attendanceMap.get(emp.id) || [];

    let presensiCount = 0;
    let izinCutiCount = 0;
    let terlambatMinutes = 0;
    let jamKerjaMinutes = 0;
    let jamAktualMinutes = 0;
    let jamIstirahatMinutes = 0;
    let pulangAwalMinutes = 0;
    let lemburMinutes = 0;
    let hasCheckedInTodayWithoutCheckOut = false;
    let assignedShiftId: string | null = null;
    let assignedShiftName: string | null = null;
    let assignedLocationId: string | null = null;

    for (const rec of records) {
      if (rec.shiftId) assignedShiftId = rec.shiftId;
      if (rec.checkInLocationId) assignedLocationId = rec.checkInLocationId;

      const shiftInfo = rec.shiftId ? shiftMap.get(rec.shiftId) : null;
      const scheduledStart = shiftInfo ? shiftInfo.start : defaultShiftStart;
      const scheduledEnd = shiftInfo ? shiftInfo.end : defaultShiftEnd;
      const scheduledDuration = shiftInfo ? shiftInfo.duration : defaultShiftDuration;

      if (rec.status === "present" || rec.status === "late") {
        presensiCount += 1;
        jamKerjaMinutes += scheduledDuration;

        // Check in
        const inM = parseTimeToMinutes(rec.checkIn);
        const outM = parseTimeToMinutes(rec.checkOut);

        if (inM !== null) {
          // Terlambat
          if (inM > scheduledStart) {
            terlambatMinutes += inM - scheduledStart;
          }

          // Check out & actual hours
          if (outM !== null) {
            let breakMinutes = 60; // default 1 hour
            const bStart = parseTimeToMinutes(rec.breakStart);
            const bEnd = parseTimeToMinutes(rec.breakEnd);
            if (bStart !== null && bEnd !== null && bEnd > bStart) {
              breakMinutes = bEnd - bStart;
            }
            jamIstirahatMinutes += breakMinutes;

            const totalDuration = Math.max(0, outM - inM);
            const actualWork = Math.max(0, totalDuration - breakMinutes);
            jamAktualMinutes += actualWork;

            // Pulang lebih awal
            if (outM < scheduledEnd) {
              pulangAwalMinutes += scheduledEnd - outM;
            }

            // Lembur
            if (outM > scheduledEnd) {
              lemburMinutes += outM - scheduledEnd;
            }
          } else {
            // Belum keluar
            hasCheckedInTodayWithoutCheckOut = true;
          }
        }
      } else if (rec.status === "leave" || rec.status === "absent") {
        izinCutiCount += 1;
      }
    }

    if (assignedShiftId && shiftMap.has(assignedShiftId)) {
      assignedShiftName = shiftMap.get(assignedShiftId)!.name;
    }

    summaries.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode || "—",
      employeeName: emp.name,
      department: emp.department || "Umum",
      shiftId: assignedShiftId,
      shiftName: assignedShiftName,
      locationId: assignedLocationId,
      locationName: null,
      presensiCount,
      izinCutiCount,
      terlambatMinutes,
      jamKerjaMinutes,
      jamAktualMinutes,
      jamIstirahatMinutes,
      pulangAwalMinutes,
      lemburMinutes,
      hasCheckedInTodayWithoutCheckOut,
    });
  }

  return summaries;
}

// ============================================================================
// EXPORT EXCEL SESUAI GAMBAR 3
// Headers:
// A: Nomor Induk
// B: Nama Karyawan
// C: Jumlah Kehadiran (contoh: 0 hari)
// D: Jumlah Izin/Cuti (contoh: 0 hari)
// E: Jumlah Waktu Terlambat (contoh: 0 Jam 0 Menit)
// F: Jumlah Jam Kerja (contoh: 0 Jam 0 Menit)
// G: Jumlah Jam Aktual (contoh: 0 Jam 0 Menit)
// H: Jumlah Jam Istirahat (contoh: 0 Jam 0 Menit)
// I: Jumlah Jam Pulang Lebih Awal (contoh: 0 Jam 0 Menit)
// J: Jumlah Jam Lembur (contoh: 0 Jam 0 Menit)
// ============================================================================
export async function exportMonthlyAttendanceExcel(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedCompanyId = searchParams.get("companyId");
  const context = await attendanceManagerContext(request, requestedCompanyId);

  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
  const query = searchParams.get("q") || undefined;
  const locationId = searchParams.get("locationId") || undefined;
  const division = searchParams.get("division") || undefined;
  const shiftId = searchParams.get("shiftId") || undefined;

  const data = await fetchMonthlyAttendanceSummary({
    companyId: context.companyId,
    year,
    month,
    query,
    locationId,
    division,
    shiftId,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TepatWaktu";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`Laporan-${month}-${year}`, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nomor Induk", key: "employeeCode", width: 16 },
    { header: "Nama Karyawan", key: "employeeName", width: 28 },
    { header: "Jumlah Kehadiran", key: "presensiCount", width: 18 },
    { header: "Jumlah Izin/Cuti", key: "izinCutiCount", width: 18 },
    { header: "Jumlah Waktu Terlambat", key: "terlambat", width: 25 },
    { header: "Jumlah Jam Kerja", key: "jamKerja", width: 22 },
    { header: "Jumlah Jam Aktual", key: "jamAktual", width: 22 },
    { header: "Jumlah Jam Istirahat", key: "jamIstirahat", width: 22 },
    { header: "Jumlah Jam Pulang Lebih Awal", key: "pulangAwal", width: 28 },
    { header: "Jumlah Jam Lembur", key: "lembur", width: 22 },
  ];

  for (const item of data) {
    sheet.addRow({
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      presensiCount: `${item.presensiCount} hari`,
      izinCutiCount: `${item.izinCutiCount} hari`,
      terlambat: formatMinutesExcel(item.terlambatMinutes),
      jamKerja: formatMinutesExcel(item.jamKerjaMinutes),
      jamAktual: formatMinutesExcel(item.jamAktualMinutes),
      jamIstirahat: formatMinutesExcel(item.jamIstirahatMinutes),
      pulangAwal: formatMinutesExcel(item.pulangAwalMinutes),
      lembur: formatMinutesExcel(item.lemburMinutes),
    });
  }

  // Header Styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: "Arial", bold: true, color: { argb: "FF0F172A" }, size: 10 };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  for (let i = 2; i <= data.length + 1; i++) {
    const row = sheet.getRow(i);
    row.height = 20;
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="laporan-kehadiran-${year}-${String(month).padStart(2, "0")}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}

// ============================================================================
// TEMPLATE EXCEL SESUAI GAMBAR 4
// ============================================================================
export async function generateMonthlyAttendanceTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TepatWaktu";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Template Kehadiran", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nomor Induk", key: "employeeCode", width: 18 },
    { header: "Tanggal (YYYY-MM-DD)", key: "date", width: 22 },
    { header: "Jam Masuk (HH:mm)", key: "checkIn", width: 18 },
    { header: "Jam Keluar (HH:mm)", key: "checkOut", width: 18 },
    { header: "Mulai Istirahat (HH:mm)", key: "breakStart", width: 22 },
    { header: "Selesai Istirahat (HH:mm)", key: "breakEnd", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Keterangan", key: "note", width: 30 },
  ];

  sheet.addRow({
    employeeCode: "EMP-001",
    date: "2026-10-21",
    checkIn: "08:00",
    checkOut: "17:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    status: "present",
    note: "Hadir normal",
  });

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
  headerRow.alignment = { vertical: "middle" };

  const guideSheet = workbook.addWorksheet("Panduan");
  guideSheet.columns = [
    { header: "Kolom", key: "col", width: 25 },
    { header: "Petunjuk Pengisian", key: "desc", width: 55 },
  ];
  guideSheet.addRow({ col: "Nomor Induk", desc: "Wajib diisi sesuai kode karyawan di TepatWaktu." });
  guideSheet.addRow({ col: "Tanggal", desc: "Format YYYY-MM-DD, contoh: 2026-10-21." });
  guideSheet.addRow({ col: "Jam Masuk", desc: "Format HH:mm, contoh: 08:00." });
  guideSheet.addRow({ col: "Jam Keluar", desc: "Format HH:mm, contoh: 17:00." });
  guideSheet.addRow({ col: "Mulai Istirahat", desc: "Opsional, format HH:mm, contoh: 12:00." });
  guideSheet.addRow({ col: "Selesai Istirahat", desc: "Opsional, format HH:mm, contoh: 13:00." });
  guideSheet.addRow({ col: "Status", desc: "Pilih salah satu: present / late / leave / absent." });
  guideSheet.addRow({ col: "Keterangan", desc: "Opsional, catatan kehadiran." });

  guideSheet.getRow(1).font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
  guideSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"template-import-kehadiran.xlsx\"",
      "cache-control": "private, no-store",
    },
  });
}

// ============================================================================
// IMPORT EXCEL SESUAI GAMBAR 4
// ============================================================================
export async function importMonthlyAttendanceExcel(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedCompanyId = searchParams.get("companyId");
  const context = await attendanceManagerContext(request, requestedCompanyId);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Pilih file Excel terlebih dahulu." }, { status: 400 });
  }

  if (!file.name.endsWith(".xlsx")) {
    return Response.json({ error: "Format file harus .xlsx (Excel)." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return Response.json({ error: "Lembar kerja Excel kosong." }, { status: 400 });
  }

  // Map active employees for quick lookup by employeeCode
  const existingEmployees = await db
    .select({ id: employees.id, employeeCode: employees.employeeCode, name: employees.name })
    .from(employees)
    .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active")));

  const empByCode = new Map<string, string>();
  for (const emp of existingEmployees) {
    if (emp.employeeCode) empByCode.set(emp.employeeCode.trim().toLowerCase(), emp.id);
  }

  const validStatuses = new Set(["present", "late", "leave", "absent"]);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;

  const errors: string[] = [];
  const rowsToInsert: {
    companyId: string;
    employeeId: string;
    attendanceDate: string;
    checkIn: string | null;
    checkOut: string | null;
    breakStart: string | null;
    breakEnd: string | null;
    status: "present" | "late" | "leave" | "absent";
    note: string | null;
  }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const code = String(row.getCell(1).value ?? "").trim();
    let dateVal = String(row.getCell(2).value ?? "").trim();
    let checkIn = String(row.getCell(3).value ?? "").trim() || null;
    let checkOut = String(row.getCell(4).value ?? "").trim() || null;
    let breakStart = String(row.getCell(5).value ?? "").trim() || null;
    let breakEnd = String(row.getCell(6).value ?? "").trim() || null;
    const rawStatus = String(row.getCell(7).value ?? "").trim().toLowerCase();
    const note = String(row.getCell(8).value ?? "").trim() || "Diimpor via Excel";

    if (!code) return; // Skip empty row

    const employeeId = empByCode.get(code.toLowerCase());
    if (!employeeId) {
      errors.push(`Baris ${rowNumber}: Pegawai dengan kode "${code}" tidak ditemukan.`);
      return;
    }

    // Parse date if Excel date object
    if (dateVal.includes("T")) dateVal = dateVal.split("T")[0];
    if (!dateRegex.test(dateVal)) {
      errors.push(`Baris ${rowNumber}: Format tanggal "${dateVal}" tidak valid (gunakan YYYY-MM-DD).`);
      return;
    }

    const status = validStatuses.has(rawStatus)
      ? (rawStatus as "present" | "late" | "leave" | "absent")
      : "present";

    // Normalize time to HH:mm:ss
    if (checkIn && timeRegex.test(checkIn) && checkIn.length === 5) checkIn = `${checkIn}:00`;
    if (checkOut && timeRegex.test(checkOut) && checkOut.length === 5) checkOut = `${checkOut}:00`;
    if (breakStart && timeRegex.test(breakStart) && breakStart.length === 5) breakStart = `${breakStart}:00`;
    if (breakEnd && timeRegex.test(breakEnd) && breakEnd.length === 5) breakEnd = `${breakEnd}:00`;

    rowsToInsert.push({
      companyId: context.companyId,
      employeeId,
      attendanceDate: dateVal,
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
      status,
      note,
    });
  });

  if (errors.length > 0) {
    return Response.json(
      { error: "Data import memiliki kesalahan validasi.", details: errors.slice(0, 10) },
      { status: 400 }
    );
  }

  if (rowsToInsert.length === 0) {
    return Response.json({ error: "Tidak ada baris data valid untuk diimpor." }, { status: 400 });
  }

  // Upsert into attendances
  let importedCount = 0;
  for (const item of rowsToInsert) {
    await db
      .insert(attendances)
      .values(item)
      .onConflictDoUpdate({
        target: [attendances.employeeId, attendances.attendanceDate],
        set: {
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          breakStart: item.breakStart,
          breakEnd: item.breakEnd,
          status: item.status,
          note: item.note,
          updatedAt: new Date(),
        },
      });
    importedCount += 1;
  }

  return Response.json({
    ok: true,
    count: importedCount,
    message: `Berhasil mengimpor ${importedCount} data kehadiran.`,
  });
}
