/**
 * Shift clock maths shared by check-in (late status), the payslip (late minutes) and the shift picker
 * (late preview). Pure, so it runs on the server and in the browser.
 */

/** "HH:MM[:SS]" -> minutes since midnight. */
export const clockMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** True when the shift ends on the next day (e.g. 22:00–06:00). */
export const crossesMidnight = (startTime: string, endTime: string) => clockMinutes(endTime) <= clockMinutes(startTime);

/**
 * Minutes a check-in is after the shift start (0 when on time or early).
 * For a shift that crosses midnight, a check-in shortly after midnight is late on the same shift
 * (start 22:00, check-in 00:10 -> 130), not 21 hours early.
 */
export function minutesLate(checkIn: string, startTime: string, endTime: string) {
  let diff = clockMinutes(checkIn) - clockMinutes(startTime);
  if (crossesMidnight(startTime, endTime) && diff < -720) diff += 1440;
  return Math.max(0, diff);
}

/** One work schedule of the employee's division that works on the given day (for the shift picker). */
export type ShiftOption = { id: string; name: string; startTime: string; endTime: string; graceMinutes: number };
