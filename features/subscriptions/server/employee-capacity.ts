import { and, desc, eq, sql } from "drizzle-orm";
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

type Executor = Pick<typeof db, "select" | "execute">;

/**
 * Seats used against the plan of the company's current subscription. A seat is one person who works
 * in the company, the Administrator (admin/owner) never counts:
 * - every active employee, except one linked to an admin/owner login;
 * - every active non-admin login without an active employee record (deactivated or deleted employee
 *   whose login was kept), so logins can never outnumber the plan.
 * `excludeEmployeeId` / `excludeUserId` leave one person out, to ask "is there room for them?".
 */
export async function employeeCapacity(companyId: string, executor: Executor = db, options: { excludeEmployeeId?: string; excludeUserId?: string } = {}): Promise<EmployeeCapacity> {
  let excludeUserId = options.excludeUserId ?? null;
  if (options.excludeEmployeeId && !excludeUserId) {
    const [row] = await executor.select({ userId: employees.userId }).from(employees).where(eq(employees.id, options.excludeEmployeeId)).limit(1);
    excludeUserId = row?.userId ?? null;
  }
  const excludeEmployeeId = options.excludeEmployeeId ?? null;
  const [[order], seats] = await Promise.all([
    executor.select({ maxEmployees: subscriptionPlans.maxEmployees, planName: subscriptionPlans.name })
      .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(and(eq(subscriptionOrders.companyId, companyId), eq(subscriptionOrders.status, "active")))
      // Same pick as getSubscriptionStatus: open-ended first, then the one that runs longest.
      .orderBy(sql`${subscriptionOrders.endsAt} desc nulls first`, desc(subscriptionOrders.createdAt)).limit(1),
    executor.execute<{ value: string }>(sql`select (
      select count(*) from employees e
      where e.company_id = ${companyId} and e.status = 'active'
        and (${excludeEmployeeId}::uuid is null or e.id <> ${excludeEmployeeId}::uuid)
        and (${excludeUserId}::text is null or e.user_id is null or e.user_id <> ${excludeUserId}::text)
        and not exists (select 1 from company_members m where m.company_id = e.company_id and m.user_id = e.user_id and m.role in ('admin', 'owner'))
    ) + (
      select count(*) from company_members m
      where m.company_id = ${companyId} and m.is_active and m.role not in ('admin', 'owner')
        and (${excludeUserId}::text is null or m.user_id <> ${excludeUserId}::text)
        and not exists (select 1 from employees e where e.company_id = m.company_id and e.user_id = m.user_id and e.status = 'active')
    ) as value`),
  ]);
  const active = Number(seats.rows[0]?.value ?? 0);
  const max = order?.maxEmployees ?? null;
  return { max, active, planName: order?.planName ?? null, full: max !== null && active >= max };
}

export function employeeLimitMessage(capacity: EmployeeCapacity) {
  return `Batas paket ${capacity.planName ?? ""} tercapai: maksimal ${capacity.max?.toLocaleString("id-ID")} karyawan / user login aktif (Administrator tidak dihitung), saat ini ${capacity.active.toLocaleString("id-ID")}. Nonaktifkan karyawan atau user login yang sudah tidak bekerja, atau upgrade paket di menu Langganan.`.replace("paket  tercapai", "paket tercapai");
}

/**
 * Message when one login (by user id) would not fit the plan as a counted seat, otherwise null.
 * Use when a login starts to count: Administrator changed to another role, or a login re-activated.
 */
export async function seatLimitError(companyId: string, userId: string) {
  const capacity = await employeeCapacity(companyId, db, { excludeUserId: userId });
  return capacity.full ? employeeLimitMessage(capacity) : null;
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
