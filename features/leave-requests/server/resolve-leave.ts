import { checkAnnualLeave } from "./annual-balance";
import { resolveSpecialLeave } from "./special-types";

type LeaveInput = { employeeId: string; type: string; specialLeaveTypeId?: string | null; startDate: string; endDate: string };

/**
 * Rules applied before a request is saved: Cuti Khusus (kind, fixed duration) and Cuti Tahunan
 * (working days within the remaining quota of the employee's leave period). `editingId` = request being edited.
 */
export async function resolveLeaveRules(companyId: string, input: LeaveInput, editingId?: string) {
  if (input.type !== "annual") return resolveSpecialLeave(companyId, input);
  const check = await checkAnnualLeave(companyId, input, editingId);
  if (!check.ok) return { ok: false as const, error: check.error };
  return { ok: true as const, values: { specialLeaveTypeId: null, specialLeaveName: null, workDays: check.workDays, startDate: input.startDate, endDate: input.endDate }, paid: undefined };
}
