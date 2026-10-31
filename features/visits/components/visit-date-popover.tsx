"use client";

import { useMemo, useState } from "react";

type Preset = "today" | "yesterday" | "3days" | "custom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

type Props = {
  initialFrom?: string; // YYYY-MM-DD
  initialTo?: string; // YYYY-MM-DD
  onApply: (from: string, to: string, label: string) => void;
  onCancel: () => void;
};

export function VisitDatePopover({ initialFrom, initialTo, onApply, onCancel }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const [preset, setPreset] = useState<Preset>("today");

  // From date states
  const [fromDate, setFromDate] = useState<Date>(() => {
    if (initialFrom) return new Date(`${initialFrom}T00:00:00Z`);
    return today;
  });
  const [fromHour, setFromHour] = useState(0);
  const [fromMinute, setFromMinute] = useState(0);
  const [fromViewMonth, setFromViewMonth] = useState(fromDate.getUTCMonth());
  const [fromViewYear, setFromViewYear] = useState(fromDate.getUTCFullYear());

  // To date states
  const [toDate, setToDate] = useState<Date>(() => {
    if (initialTo) return new Date(`${initialTo}T00:00:00Z`);
    return today;
  });
  const [toHour, setToHour] = useState(23);
  const [toMinute, setToMinute] = useState(59);
  const [toViewMonth, setToViewMonth] = useState(toDate.getUTCMonth());
  const [toViewYear, setToViewYear] = useState(toDate.getUTCFullYear());

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p === "today") {
      setFromDate(today);
      setToDate(today);
      setFromHour(0);
      setFromMinute(0);
      setToHour(23);
      setToMinute(59);
      setFromViewMonth(today.getUTCMonth());
      setFromViewYear(today.getUTCFullYear());
      setToViewMonth(today.getUTCMonth());
      setToViewYear(today.getUTCFullYear());
    } else if (p === "yesterday") {
      const yest = new Date(today);
      yest.setUTCDate(yest.getUTCDate() - 1);
      setFromDate(yest);
      setToDate(yest);
      setFromHour(0);
      setFromMinute(0);
      setToHour(23);
      setToMinute(59);
      setFromViewMonth(yest.getUTCMonth());
      setFromViewYear(yest.getUTCFullYear());
      setToViewMonth(yest.getUTCMonth());
      setToViewYear(yest.getUTCFullYear());
    } else if (p === "3days") {
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 2);
      setFromDate(threeDaysAgo);
      setToDate(today);
      setFromHour(0);
      setFromMinute(0);
      setToHour(23);
      setToMinute(59);
      setFromViewMonth(threeDaysAgo.getUTCMonth());
      setFromViewYear(threeDaysAgo.getUTCFullYear());
      setToViewMonth(today.getUTCMonth());
      setToViewYear(today.getUTCFullYear());
    }
  };

  const formatDisplay = (d: Date, h: number, m: number) => {
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    const hour = String(h).padStart(2, "0");
    const min = String(m).padStart(2, "0");
    return `${day}-${month}-${year} ${hour}:${min}`;
  };

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);

  const handleApply = () => {
    const fromStr = toISODate(fromDate);
    const toStr = toISODate(toDate);
    const label = `${formatDisplay(fromDate, fromHour, fromMinute)} - ${formatDisplay(toDate, toHour, toMinute)}`;
    onApply(fromStr, toStr, label);
  };

  // Helper to build 7x6 calendar grid starting on Monday
  const buildCalendarDays = (month: number, year: number) => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    // 0 is Sunday, 1 is Monday ... convert to Monday = 0, Sunday = 6
    const startWeekday = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = lastDay.getUTCDate();

    const prevMonthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: { date: Date; dayNumber: number; inMonth: boolean }[] = [];

    // Preceding days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(year, month - 1, prevMonthLastDay - i));
      cells.push({ date: d, dayNumber: prevMonthLastDay - i, inMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Date.UTC(year, month, i));
      cells.push({ date: d, dayNumber: i, inMonth: true });
    }

    // Trailing days to fill 35 or 42 cells (5 or 6 weeks)
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(Date.UTC(year, month + 1, i));
      cells.push({ date: d, dayNumber: i, inMonth: false });
    }

    return cells;
  };

  const fromCalendarDays = useMemo(
    () => buildCalendarDays(fromViewMonth, fromViewYear),
    [fromViewMonth, fromViewYear],
  );

  const toCalendarDays = useMemo(
    () => buildCalendarDays(toViewMonth, toViewYear),
    [toViewMonth, toViewYear],
  );

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate();

  const isInRange = (d: Date) => {
    const t = d.getTime();
    return t >= fromDate.getTime() && t <= toDate.getTime();
  };

  return (
    <div className="visit-popover-card">
      <div className="visit-popover-body">
        {/* Left Sidebar Presets */}
        <aside className="visit-popover-presets">
          <button
            type="button"
            className={preset === "today" ? "active" : ""}
            onClick={() => handlePreset("today")}
          >
            Today Only
          </button>
          <button
            type="button"
            className={preset === "yesterday" ? "active" : ""}
            onClick={() => handlePreset("yesterday")}
          >
            Yesterday Only
          </button>
          <button
            type="button"
            className={preset === "3days" ? "active" : ""}
            onClick={() => handlePreset("3days")}
          >
            3 Days
          </button>
          <button
            type="button"
            className={preset === "custom" ? "active" : ""}
            onClick={() => setPreset("custom")}
          >
            Custom Range
          </button>
        </aside>

        {/* Calendar Section: From & To */}
        <div className="visit-popover-calendars">
          {/* FROM DATE COLUMN */}
          <div className="visit-cal-col">
            <span className="visit-cal-col-title">From Date</span>
            <input
              type="text"
              readOnly
              className="visit-cal-date-input"
              value={formatDisplay(fromDate, fromHour, fromMinute)}
            />

            {/* Time select */}
            <div className="visit-cal-time-row">
              <select
                value={fromHour}
                onChange={(e) => {
                  setFromHour(parseInt(e.target.value, 10));
                  setPreset("custom");
                }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                value={fromMinute}
                onChange={(e) => {
                  setFromMinute(parseInt(e.target.value, 10));
                  setPreset("custom");
                }}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>

            {/* Month & Year select */}
            <div className="visit-cal-nav-row">
              <select
                value={fromViewMonth}
                onChange={(e) => setFromViewMonth(parseInt(e.target.value, 10))}
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={fromViewYear}
                onChange={(e) => setFromViewYear(parseInt(e.target.value, 10))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Weekday headers */}
            <div className="visit-cal-grid-head">
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
              <span>Su</span>
            </div>

            {/* Days grid */}
            <div className="visit-cal-grid">
              {fromCalendarDays.map((cell, idx) => {
                const selected = isSameDay(cell.date, fromDate);
                const inRange = isInRange(cell.date);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`visit-cal-day ${!cell.inMonth ? "outside" : ""} ${
                      selected ? "selected" : ""
                    } ${inRange && !selected ? "in-range" : ""}`}
                    onClick={() => {
                      setFromDate(cell.date);
                      setFromViewMonth(cell.date.getUTCMonth());
                      setFromViewYear(cell.date.getUTCFullYear());
                      if (cell.date > toDate) {
                        setToDate(cell.date);
                        setToViewMonth(cell.date.getUTCMonth());
                        setToViewYear(cell.date.getUTCFullYear());
                      }
                      setPreset("custom");
                    }}
                  >
                    {cell.dayNumber}
                  </button>
                );
              })}
            </div>

            <div className="visit-cal-legend">
              From Date <span className="legend-dot green"></span>
            </div>
          </div>

          {/* TO DATE COLUMN */}
          <div className="visit-cal-col">
            <span className="visit-cal-col-title">To Date</span>
            <input
              type="text"
              readOnly
              className="visit-cal-date-input"
              value={formatDisplay(toDate, toHour, toMinute)}
            />

            {/* Time select */}
            <div className="visit-cal-time-row">
              <select
                value={toHour}
                onChange={(e) => {
                  setToHour(parseInt(e.target.value, 10));
                  setPreset("custom");
                }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                value={toMinute}
                onChange={(e) => {
                  setToMinute(parseInt(e.target.value, 10));
                  setPreset("custom");
                }}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>

            {/* Month & Year select */}
            <div className="visit-cal-nav-row">
              <select
                value={toViewMonth}
                onChange={(e) => setToViewMonth(parseInt(e.target.value, 10))}
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={toViewYear}
                onChange={(e) => setToViewYear(parseInt(e.target.value, 10))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Weekday headers */}
            <div className="visit-cal-grid-head">
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
              <span>Su</span>
            </div>

            {/* Days grid */}
            <div className="visit-cal-grid">
              {toCalendarDays.map((cell, idx) => {
                const selected = isSameDay(cell.date, toDate);
                const inRange = isInRange(cell.date);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`visit-cal-day ${!cell.inMonth ? "outside" : ""} ${
                      selected ? "selected" : ""
                    } ${inRange && !selected ? "in-range" : ""}`}
                    onClick={() => {
                      setToDate(cell.date);
                      setToViewMonth(cell.date.getUTCMonth());
                      setToViewYear(cell.date.getUTCFullYear());
                      if (cell.date < fromDate) {
                        setFromDate(cell.date);
                        setFromViewMonth(cell.date.getUTCMonth());
                        setFromViewYear(cell.date.getUTCFullYear());
                      }
                      setPreset("custom");
                    }}
                  >
                    {cell.dayNumber}
                  </button>
                );
              })}
            </div>

            <div className="visit-cal-legend">
              To Date <span className="legend-dot red"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Popover Footer Buttons */}
      <footer className="visit-popover-footer">
        <button type="button" className="visit-popover-apply" onClick={handleApply}>
          Apply
        </button>
        <button type="button" className="visit-popover-cancel" onClick={onCancel}>
          Cancel
        </button>
      </footer>
    </div>
  );
}
