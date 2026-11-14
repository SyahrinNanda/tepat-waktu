"use client";

import { Clock3 } from "lucide-react";
import { minutesLate, type ShiftOption } from "@/features/attendance/shift-time";

const short = (value: string) => value.slice(0, 5);

/**
 * Step before the camera for a division with several shifts that day: the employee says which shift
 * they are working, so lateness (and the payslip) is measured against that shift's start time.
 * `nowTime` is the company clock ("HH:MM:SS") used for the on-time / late preview.
 */
export function ShiftPicker({ shifts, value, nowTime, onChange }: {
  shifts: ShiftOption[];
  value: string;
  nowTime: string;
  onChange: (id: string) => void;
}) {
  return <div className="shift-picker">
    <p className="shift-picker-intro">Divisi Anda memiliki lebih dari satu jadwal kerja hari ini. Pilih shift yang sedang Anda jalani. Keterlambatan dan slip gaji dihitung dari jam masuk shift ini.</p>
    <div className="shift-picker-list" role="radiogroup" aria-label="Shift kerja">
      {shifts.map((shift) => {
        const late = minutesLate(nowTime, shift.startTime, shift.endTime);
        const isLate = late > shift.graceMinutes;
        return <label key={shift.id} className={`shift-picker-option${value === shift.id ? " selected" : ""}`}>
          <input type="radio" name="shift" value={shift.id} checked={value === shift.id} onChange={() => onChange(shift.id)}/>
          <span className="shift-picker-main">
            <strong>{shift.name}</strong>
            <small><Clock3 size={13}/> {short(shift.startTime)} – {short(shift.endTime)} · toleransi {shift.graceMinutes} menit</small>
          </span>
          <span className={`shift-picker-status ${isLate ? "late" : "ontime"}`}>{isLate ? `Terlambat ${formatLate(late)}` : "Tepat waktu"}</span>
        </label>;
      })}
    </div>
  </div>;
}

function formatLate(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} jam` : "", m ? `${m} mnt` : ""].filter(Boolean).join(" ") || "0 mnt";
}
