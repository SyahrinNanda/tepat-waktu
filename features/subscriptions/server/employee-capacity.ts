import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, subscriptionOrders, subscriptionPlans } from "@/db/schema";

export type EmployeeCapacity = {
  /** Plan limit on active employees; null when the company has no plan (legacy, unlimited). */
  max: number | null;
  active: number;
  planName: string | null;
  /** True when no more active employees can be added. */
  full: boolean;
};

type Executor = Pick<typeof db, "select">;

/** Active-employee usage against the plan of the company's current subscription. */
export async function employeeCapacity(companyId: string, executor: Executor = db, options: { excludeEmployeeId?: string } = {}): Promise<EmployeeCapacity> {
  const [[order], [usage]] = await Promise.all([
    executor.select({ maxEmployees: subscriptionPlans.maxEmployees, planName: subscriptionPlans.name })
      .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(and(eq(subscriptionOrders.companyId, companyId), eq(subscriptionOrders.status, "active")))
      // Same pick as getSubscriptionStatus: open-ended first, then the one that runs longest.
      .orderBy(sql`${subscriptionOrders.endsAt} desc nulls first`, desc(subscriptionOrders.createdAt)).limit(1),
    executor.select({ value: count() }).from(employees)
      .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"), options.excludeEmployeeId ? ne(employees.id, options.excludeEmployeeId) : undefined)),
  ]);
  const active = Number(usage?.value ?? 0);
  const max = order?.maxEmployees ?? null;
  return { max, active, planName: order?.planName ?? null, full: max !== null && active >= max };
}

export function employeeLimitMessage(capacity: EmployeeCapacity) {
  return `Batas paket ${capacity.planName ?? ""} tercapai: maksimal ${capacity.max?.toLocaleString("id-ID")} karyawan aktif, saat ini ${capacity.active.toLocaleString("id-ID")}. Nonaktifkan karyawan yang sudah tidak bekerja, atau upgrade paket di menu Langganan.`.replace("paket  tercapai", "paket tercapai");
}

export class EmployeeLimitError extends Error {
  constructor(readonly capacity: EmployeeCapacity) {
    super(employeeLimitMessage(capacity));
  }
}

/**
 * Throws EmployeeLimitError when one more active employee would exceed the plan.
 * Pass `excludeEmployeeId` when re-activating an existing employee.
 */
export async function assertEmployeeCapacity(companyId: string, executor: Executor = db, options: { excludeEmployeeId?: string } = {}) {
  const capacity = await employeeCapacity(companyId, executor, options);
  if (capacity.full) throw new EmployeeLimitError(capacity);
  return capacity;
}
