import ExcelJS from "exceljs";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { attendanceLocations, attendances, employees, workSchedules } from "@/db/schema";
import { attendanceManagerContext } from "@/features/attendance/server/attendance-service";

export const runtime = "nodejs";

const headers = [
  "Tanggal",
  "ID Pegawai",
  "Nama Pegawai",
  "Divisi",
  "Shift",
  "Jam Masuk",
  "Lokasi Masuk",
  "Jam Keluar",
  "Lokasi Keluar",
  "Mulai Istirahat",
  "Selesai Istirahat",
  "Status",
  "Catatan",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("companyId");
    const context = await attendanceManagerContext(request, requestedCompanyId);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const checkInLocation = alias(attendanceLocations, "export_check_in_loc");
    const checkOutLocation = alias(attendanceLocations, "export_check_out_loc");

    const rows = await db
      .select({
        date: attendances.attendanceDate,
        employeeCode: employees.employeeCode,
        employeeName: employees.name,
        department: employees.department,
        shiftName: workSchedules.name,
        checkIn: attendances.checkIn,
        checkInLocation: checkInLocation.name,
        checkOut: attendances.checkOut,
        checkOutLocation: checkOutLocation.name,
        breakStart: attendances.breakStart,
        breakEnd: attendances.breakEnd,
        status: attendances.status,
        note: attendances.note,
      })
      .from(attendances)
      .innerJoin(employees, eq(attendances.employeeId, employees.id))
      .leftJoin(workSchedules, eq(attendances.shiftId, workSchedules.id))
      .leftJoin(checkInLocation, eq(attendances.checkInLocationId, checkInLocation.id))
      .leftJoin(checkOutLocation, eq(attendances.checkOutLocationId, checkOutLocation.id))
      .where(and(eq(attendances.companyId, context.companyId), eq(attendances.attendanceDate, date)))
      .orderBy(asc(employees.name));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TepatWaktu";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Presensi Harian", { views: [{ state: "frozen", ySplit: 1 }] });

    sheet.columns = [
      { header: headers[0], key: "date", width: 15 },
      { header: headers[1], key: "employeeCode", width: 15 },
      { header: headers[2], key: "employeeName", width: 25 },
      { header: headers[3], key: "department", width: 18 },
      { header: headers[4], key: "shiftName", width: 20 },
      { header: headers[5], key: "checkIn", width: 14 },
      { header: headers[6], key: "checkInLocation", width: 20 },
      { header: headers[7], key: "checkOut", width: 14 },
      { header: headers[8], key: "checkOutLocation", width: 20 },
      { header: headers[9], key: "breakStart", width: 16 },
      { header: headers[10], key: "breakEnd", width: 16 },
      { header: headers[11], key: "status", width: 15 },
      { header: headers[12], key: "note", width: 32 },
    ];

    const statusMap: Record<string, string> = {
      present: "Hadir",
      late: "Terlambat",
      leave: "Izin / Cuti",
      absent: "Alpa",
    };

    for (const row of rows) {
      sheet.addRow({
        ...row,
        status: statusMap[row.status] || row.status,
        checkIn: row.checkIn ? row.checkIn.slice(0, 5) : "—",
        checkOut: row.checkOut ? row.checkOut.slice(0, 5) : "—",
        breakStart: row.breakStart ? row.breakStart.slice(0, 5) : "—",
        breakEnd: row.breakEnd ? row.breakEnd.slice(0, 5) : "—",
      });
    }

    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087BC5" } };
    headerRow.alignment = { vertical: "middle" };

    for (let i = 2; i <= rows.length + 1; i++) {
      const r = sheet.getRow(i);
      r.font = { name: "Arial", size: 10 };
      r.alignment = { vertical: "middle" };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="presensi-harian-${date}.xlsx"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Export daily attendance error:", error);
    return new Response(JSON.stringify({ message: "Gagal mengunduh laporan presensi." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
