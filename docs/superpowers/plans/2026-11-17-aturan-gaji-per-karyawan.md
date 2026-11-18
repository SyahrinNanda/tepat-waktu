# Aturan Alpa & Terlambat per Karyawan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aturan alpa/terlambat per karyawan (bawaan: ikuti perusahaan), alpa manual + "Libur" untuk karyawan berjadwal tidak tetap, dan menu Perhitungan Gaji + Aturan Cuti di Master Data.

**Architecture:** Kolom baru di `employee_salary_profiles`; `buildPayslip` (murni) menerima aturan karyawan dan menurunkan aturan efektif; UI di Daftar Gaji Karyawan; laporan harian/bulanan membedakan Alpa/Izin/Libur.

**Tech Stack:** Next.js 16, Drizzle/Postgres, zod 4, tsx untuk tes murni.

**Spec:** `docs/superpowers/specs/2026-11-17-aturan-gaji-per-karyawan-design.md`

## Global Constraints
- Bawaan semua karyawan = ikuti perusahaan; slip/gaji yang ada tidak berubah tanpa tindakan admin.
- Mode terlambat karyawan: `per_minute` | `per_hour` | `per_day` (tanpa "per bulan").
- Slip terkunci tidak dihitung ulang. Edit Massal divisi tidak mengubah aturan ini.
- Teks UI berbahasa Indonesia.

## Review Focus
- Karyawan tanpa profil gaji (left join null) → aturan perusahaan.
- `manual_only` + cuti dibayar di hari yang bukan hari kerja divisi → tetap dibayar (gaji harian/jam).
- `manual_only` + bulanan: hari kosong tidak memotong; alpa manual × nominal; nominal 0 → tanpa potongan.
- `late_rule=none` → tidak ada baris Terlambat walau aturan perusahaan memotong.
- Laporan harian hari ini: karyawan `manual_only` tanpa catatan tetap "Belum Tercatat" (bisa masih check-in); hari lampau → "Libur".

---

### Task 1: Skema + migrasi
**Files:** Modify `db/schema.ts` (employeeSalaryProfiles); Create `drizzle/0053_employee_attendance_rules.sql`; Modify `drizzle/meta/_journal.json`.
- Kolom: `absent_rule text default 'company' not null`, `absent_manual_amount bigint default 0 not null`, `late_rule text default 'company' not null`, `late_mode text default 'per_day' not null`, `late_amount bigint default 0 not null`.
- [ ] Tulis migrasi (`ADD COLUMN IF NOT EXISTS`), jalankan `npm run db:migrate`, cek kolom ada.

### Task 2: Perhitungan slip
**Files:** Modify `features/payslips/server/payslip-calculation.ts`, `features/payslips/server/payslip-service.ts` (loadEmployee); Test `scripts/test-payslip-rules.ts` (`npx tsx`).
**Produces:** `type EmployeeAttendanceRule = { absentRule: "company"|"manual_only"; absentManualAmount: number; lateRule: "company"|"none"|"custom"; lateMode: "per_minute"|"per_hour"|"per_day"; lateAmount: number }`, `DEFAULT_EMPLOYEE_RULE` (company), `CalculationEmployee.attendanceRule?: EmployeeAttendanceRule`.
- [ ] Tes: (a) tanpa rule = hasil lama; (b) manual_only bulanan: 2 hari kosong + 1 alpa manual, nominal 50.000 → absentDays 1, potongan 50.000, tidak ada potongan tarif harian; (c) manual_only harian: cuti dibayar di hari Minggu dibayar; (d) late none → tanpa baris Terlambat; (e) late custom per_hour 10.000, telat 61 menit → 2 jam = 20.000.
- [ ] Implementasi, tes lulus.

### Task 3: Simpan aturan + UI Daftar Gaji
**Files:** Modify `features/employee-salaries/server/actions.ts` (`saveAttendanceRule(input: { employeeId } & EmployeeAttendanceRule)`), `app/dashboard/karyawan/gaji/page.tsx`, `features/employee-salaries/components/salary-manager.tsx` (kolom "Alpa & Terlambat", modal), CSS.
- [ ] Validasi zod; batch tidak menyentuh kolom baru. Browser test: ubah aturan, cek DB.

### Task 4: Laporan
**Files:** `app/dashboard/presensi/harian/page.tsx` + `daily-attendance-manager.tsx` (flag `absentRule` per karyawan; "Libur" untuk hari lampau tanpa catatan), `monthly-service.ts` + `types/monthly.ts` + `monthly-attendance-manager.tsx` (pisah `alpaCount` dari `izinCutiCount`, kolom + ekspor).

### Task 5: Menu Master Data
**Files:** `components/dashboard-shell.tsx`; Create `app/dashboard/master/perhitungan-gaji/page.tsx`, `app/dashboard/master/aturan-cuti/page.tsx`; ubah halaman lama `karyawan/slip-gaji/pengaturan` → redirect; tombol di `payslip-list.tsx` dan `leave-report-manager.tsx` jadi link; form Aturan Cuti dipakai ulang dari modal; revalidate path baru.

### Task 6: Verifikasi
- [ ] tsc, lint, build, tes isolasi & presensi, tes browser end-to-end (slip karyawan manual_only), commit tidak dilakukan tanpa diminta.
