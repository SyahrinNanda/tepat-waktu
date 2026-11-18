import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { positions, positionSchedules, workSchedules } from "@/db/schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Position form body. `scheduleIds` holds one or more work schedules in the order chosen; the first is
 * the primary one (positions.schedule_id). A single legacy `scheduleId` is still accepted.
 */
export const positionBodySchema = z.object({
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

/** Replaces the position's schedule list with `scheduleIds` (in order). */
export async function replacePositionSchedules(executor: Executor, positionId: string, scheduleIds: string[]) {
  await executor.delete(positionSchedules).where(eq(positionSchedules.positionId, positionId));
  if (scheduleIds.length) await executor.insert(positionSchedules).values(scheduleIds.map((scheduleId, sortOrder) => ({ positionId, scheduleId, sortOrder })));
}

export type PositionListRow = { id: string; name: string; scheduleId: string | null; scheduleIds: string[]; shiftNames: string[]; active: boolean };

/** Positions of a company with all their schedules (ids + names, primary first). */
export async function listPositionsWithSchedules(companyId: string, positionId?: string): Promise<PositionListRow[]> {
  const where = positionId ? and(eq(positions.companyId, companyId), eq(positions.id, positionId)) : eq(positions.companyId, companyId);
  const [rows, links] = await Promise.all([
    db.select({ id: positions.id, name: positions.name, scheduleId: positions.scheduleId, active: positions.active }).from(positions).where(where).orderBy(asc(positions.name)),
    db.select({ positionId: positionSchedules.positionId, scheduleId: workSchedules.id, name: workSchedules.name })
      .from(positionSchedules).innerJoin(positions, eq(positions.id, positionSchedules.positionId)).innerJoin(workSchedules, eq(workSchedules.id, positionSchedules.scheduleId))
      .where(where).orderBy(asc(positionSchedules.sortOrder), asc(workSchedules.name)),
  ]);
  return rows.map((row) => {
    const own = links.filter((link) => link.positionId === row.id);
    return { ...row, scheduleIds: own.map((link) => link.scheduleId), shiftNames: own.map((link) => link.name) };
  });
}
