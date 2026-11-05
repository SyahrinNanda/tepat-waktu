"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { divisions, employeeSalaryComponents, employeeSalaryProfiles, employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

const money = z.coerce.number().int().min(0).max(100_000_000_000);
const basis = z.enum(["hourly", "daily", "monthly"]);
const componentSchema = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(100), unit: z.enum(["hour", "day", "month"]), amount: money });

async function salaryContext(employeeId: string) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) throw new Error("Karyawan tidak ditemukan.");
  return context;
}


export async function saveSalaryBasics(input: { employeeId: string; baseSalary: number; overtimeRate: number; salaryBasis: "hourly" | "daily" | "monthly" }) {
  const parsed = z.object({ employeeId: z.uuid(), baseSalary: money, overtimeRate: money, salaryBasis: basis }).parse(input);
  const context = await salaryContext(parsed.employeeId);
  await db.insert(employeeSalaryProfiles).values({ companyId: context.companyId, ...parsed }).onConflictDoUpdate({ target: employeeSalaryProfiles.employeeId, set: { baseSalary: parsed.baseSalary, overtimeRate: parsed.overtimeRate, salaryBasis: parsed.salaryBasis, updatedAt: new Date() } });
  revalidateSalary(parsed.employeeId); return { ok: true };
}

export async function saveSalaryComponents(input: { employeeId: string; type: "compensation" | "deduction"; components: z.infer<typeof componentSchema>[] }) {
  const parsed = z.object({ employeeId: z.uuid(), type: z.enum(["compensation", "deduction"]), components: z.array(componentSchema).max(50) }).parse(input);
  const context = await salaryContext(parsed.employeeId);
  if (new Set(parsed.components.map((item) => item.name.toLocaleLowerCase("id-ID"))).size !== parsed.components.length) throw new Error("Nama komponen tidak boleh sama.");
  await db.transaction(async (tx) => { await tx.delete(employeeSalaryComponents).where(and(eq(employeeSalaryComponents.companyId, context.companyId), eq(employeeSalaryComponents.employeeId, parsed.employeeId), eq(employeeSalaryComponents.type, parsed.type))); if (parsed.components.length) await tx.insert(employeeSalaryComponents).values(parsed.components.map((component) => ({ companyId: context.companyId, employeeId: parsed.employeeId, name: component.name, type: parsed.type, unit: component.unit, amount: component.amount }))); });
  revalidateSalary(parsed.employeeId); return { ok: true };
}

export async function saveSalaryBatch(input: { divisionId: string; baseSalary: number; overtimeRate: number; salaryBasis: "hourly" | "daily" | "monthly"; compensations: z.infer<typeof componentSchema>[]; deductions: z.infer<typeof componentSchema>[] }) {
  const parsed = z.object({ divisionId: z.uuid(), baseSalary: money, overtimeRate: money, salaryBasis: basis, compensations: z.array(componentSchema).max(50), deductions: z.array(componentSchema).max(50) }).parse(input);
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [division] = await db.select({ name: divisions.name }).from(divisions).where(and(eq(divisions.id, parsed.divisionId), eq(divisions.companyId, context.companyId))).limit(1);
  if (!division) throw new Error("Divisi tidak ditemukan.");
  const team = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.department, division.name), eq(employees.status, "active")));
  if (!team.length) throw new Error("Tidak ada karyawan aktif pada divisi ini.");
  await db.transaction(async (tx) => { for (const employee of team) { await tx.insert(employeeSalaryProfiles).values({ companyId: context.companyId, employeeId: employee.id, baseSalary: parsed.baseSalary, overtimeRate: parsed.overtimeRate, salaryBasis: parsed.salaryBasis }).onConflictDoUpdate({ target: employeeSalaryProfiles.employeeId, set: { baseSalary: parsed.baseSalary, overtimeRate: parsed.overtimeRate, salaryBasis: parsed.salaryBasis, updatedAt: new Date() } }); await tx.delete(employeeSalaryComponents).where(and(eq(employeeSalaryComponents.companyId, context.companyId), eq(employeeSalaryComponents.employeeId, employee.id))); const all = [...parsed.compensations.map((item) => ({ ...item, type: "compensation" as const })), ...parsed.deductions.map((item) => ({ ...item, type: "deduction" as const }))]; if (all.length) await tx.insert(employeeSalaryComponents).values(all.map((item) => ({ companyId: context.companyId, employeeId: employee.id, name: item.name, type: item.type, unit: item.unit, amount: item.amount }))); } });
  revalidatePath("/dashboard/karyawan/gaji"); return { ok: true, count: team.length };
}

function revalidateSalary(employeeId: string) { revalidatePath("/dashboard/karyawan/gaji"); revalidatePath(`/dashboard/karyawan/gaji/${employeeId}`); }
