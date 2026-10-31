"use client";

import type { Route } from "next";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type AttendanceEmployeeOption = {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
};

export function AttendanceEmployeeFilter({ employees, value }: { employees: AttendanceEmployeeOption[]; value: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = employees.find((employee) => employee.id === value);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return employees;
    return employees.filter((employee) => `${employee.name} ${employee.employeeCode} ${employee.department}`.toLowerCase().includes(keyword));
  }, [employees, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function selectEmployee(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("employeeId", id);
    setOpen(false);
    setQuery("");
    router.push(`${url.pathname}${url.search}` as Route);
  }

  return <div className="attendance-employee-filter" ref={rootRef}>
    <label>Pilih karyawan</label>
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span className="attendance-employee-filter-avatar"><UserRound size={17} /></span>
      <span><strong>{selected?.name ?? "Cari dan pilih karyawan"}</strong><small>{selected ? `${selected.employeeCode} · ${selected.department}` : "Nama, nomor induk, atau divisi"}</small></span>
      <ChevronDown size={17} />
    </button>
    {open ? <div className="attendance-employee-filter-popover">
      <div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, nomor induk, atau divisi..." autoFocus /></div>
      <ul>{filtered.map((employee) => <li key={employee.id}><button type="button" onClick={() => selectEmployee(employee.id)}>
        <span><strong>{employee.name}</strong><small>{employee.employeeCode} · {employee.department}</small></span>
        {employee.id === value ? <Check size={16} /> : null}
      </button></li>)}{!filtered.length ? <li className="attendance-employee-filter-empty">Karyawan tidak ditemukan.</li> : null}</ul>
    </div> : null}
  </div>;
}
