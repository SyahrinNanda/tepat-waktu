import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { employeeCapacity } from "@/features/subscriptions/server/employee-capacity";

const positionByRole: Record<string, string> = {
  general_manager: "General Manager",
  hrd: "HRD",
  manager: "Manager",
  employee: "Staf",
};

/**
 * Every member except the company admin must check in, so each needs an employee record.
 * Links an existing record by user or email, otherwise creates one. Returns null for admins
 * and for members whose employee record was deactivated (they are not re-created).
 */
export async function ensureEmployeeRecord(input: { companyId: string; userId: string; name: string; email: string; role: string }) {
  if (input.role === "admin" || input.role === "owner") return null;
  const email = input.email.toLowerCase();
  const findExisting = () => db.select({ id: employees.id, name: employees.name, userId: employees.userId, status: employees.status }).from(employees)
    .where(and(eq(employees.companyId, input.companyId), or(eq(employees.userId, input.userId), eq(employees.email, email)))).limit(1);

  let [existing] = await findExisting();
  if (!existing) {
    // No new employee beyond the plan limit (callers also check up front). This person is left out
    // of the count: as an active non-admin login they already take the seat this record fills.
    if ((await employeeCapacity(input.companyId, undefined, { excludeUserId: input.userId })).full) return null;
    try {
      await db.insert(employees).values({
        companyId: input.companyId, userId: input.userId, employeeCode: `EMP-${randomUUID().slice(0, 8).toUpperCase()}`,
        name: input.name, email, department: "Umum", position: positionByRole[input.role] ?? "Staf", joinedAt: new Date().toISOString().slice(0, 10),
      });
    } catch (error) {
      // A concurrent request may have created or linked it first; fall through and read it back.
      const code = typeof error === "object" && error && "cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause ? error.cause.code : undefined;
      if (code !== "23505") throw error;
    }
    [existing] = await findExisting();
  }
  if (!existing || existing.status !== "active") return null;
  if (!existing.userId) await db.update(employees).set({ userId: input.userId }).where(and(eq(employees.id, existing.id), eq(employees.companyId, input.companyId)));
  return { id: existing.id, name: existing.name };
}
