import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { divisions, divisionSchedules, workSchedules } from "@/db/schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Division form body. `scheduleIds` holds one or more work schedules in the order chosen; the first is
 * the primary one (divisions.schedule_id). A single legacy `scheduleId` is still accepted.
 */
export const divisionBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  scheduleIds: z.array(z.uuid()).max(20).optional(),
  scheduleId: z.uuid().optional(),
  active: z.boolean().default(true),
}).transform(({ scheduleIds, scheduleId, ...rest }) => ({ ...rest, scheduleIds: [...new Set(scheduleIds?.length ? scheduleIds : scheduleId ? [scheduleId] : [])] }))
  .refine((value) => value.scheduleIds.length > 0, { message: "Pilih minimal satu jadwal kerja." });

/** True when every id is a work schedule of this company. */
export async function schedulesBelongToCompany(companyId: string, scheduleIds: string[]) {
  const rows = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.companyId, companyId), inArray(workSchedules.id, scheduleIds)));
  return rows.length === scheduleIds.length;
}

/** Replaces the division's schedule list with `scheduleIds` (in order). */
export async function replaceDivisionSchedules(executor: Executor, divisionId: string, scheduleIds: string[]) {
  await executor.delete(divisionSchedules).where(eq(divisionSchedules.divisionId, divisionId));
  if (scheduleIds.length) await executor.insert(divisionSchedules).values(scheduleIds.map((scheduleId, position) => ({ divisionId, scheduleId, position })));
}

export type DivisionListRow = { id: string; name: string; scheduleId: string | null; scheduleIds: string[]; shiftNames: string[]; active: boolean };

/** Divisions of a company with all their schedules (ids + names, primary first). */
export async function listDivisionsWithSchedules(companyId: string, divisionId?: string): Promise<DivisionListRow[]> {
  const where = divisionId ? and(eq(divisions.companyId, companyId), eq(divisions.id, divisionId)) : eq(divisions.companyId, companyId);
  const [rows, links] = await Promise.all([
    db.select({ id: divisions.id, name: divisions.name, scheduleId: divisions.scheduleId, active: divisions.active }).from(divisions).where(where).orderBy(asc(divisions.name)),
    db.select({ divisionId: divisionSchedules.divisionId, scheduleId: workSchedules.id, name: workSchedules.name })
      .from(divisionSchedules).innerJoin(divisions, eq(divisions.id, divisionSchedules.divisionId)).innerJoin(workSchedules, eq(workSchedules.id, divisionSchedules.scheduleId))
      .where(where).orderBy(asc(divisionSchedules.position), asc(workSchedules.name)),
  ]);
  return rows.map((row) => {
    const own = links.filter((link) => link.divisionId === row.id);
    return { ...row, scheduleIds: own.map((link) => link.scheduleId), shiftNames: own.map((link) => link.name) };
  });
}
