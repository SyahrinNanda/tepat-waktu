import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";

/**
 * Whose employee data a company member may see:
 * - admin, owner, general manager, HRD: the whole company;
 * - manager: the employees of their own Divisi (nobody without an active employee record);
 * - staff: only themselves.
 */
export type AccessScope = { kind: "company" } | { kind: "team"; department: string | null } | { kind: "self"; userId: string };

export async function accessScope(input: { companyId: string; userId: string; role: string }): Promise<AccessScope> {
  if (input.role === "employee") return { kind: "self", userId: input.userId };
  if (input.role !== "manager") return { kind: "company" };
  const [own] = await db.select({ department: employees.department }).from(employees)
    .where(and(eq(employees.companyId, input.companyId), eq(employees.userId, input.userId), eq(employees.status, "active"))).limit(1);
  return { kind: "team", department: own?.department ?? null };
}

/** Condition on the `employees` table; undefined when the whole company is visible. */
export function employeeScopeFilter(scope: AccessScope): SQL | undefined {
  if (scope.kind === "company") return undefined;
  if (scope.kind === "self") return eq(employees.userId, scope.userId);
  return scope.department === null ? sql`false` : eq(employees.department, scope.department);
}

export function employeeInScope(scope: AccessScope, employee: { department: string; userId?: string | null }) {
  if (scope.kind === "company") return true;
  if (scope.kind === "self") return employee.userId === scope.userId;
  return scope.department !== null && employee.department === scope.department;
}

/** True when a manager may open a file owned by this employee (their Divisi). */
export async function managerCanSeeEmployee(companyId: string, userId: string, employeeId: string | null) {
  if (!employeeId) return false;
  const scope = await accessScope({ companyId, userId, role: "manager" });
  const [owner] = await db.select({ department: employees.department }).from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  return Boolean(owner && employeeInScope(scope, owner));
}
