"use client";

import { useMemo, useState } from "react";
import { Inbox, RotateCcw, Search } from "lucide-react";
import type { CashAdvancePaymentRow } from "@/features/cash-advance-payments/types";

function money(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function CashAdvancePaymentManager({ initialRows }: { initialRows: CashAdvancePaymentRow[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id-ID");
    if (!term) return initialRows;
    return initialRows.filter((row) =>
      `${row.employeeName} ${row.employeeCode}`.toLocaleLowerCase("id-ID").includes(term),
    );
  }, [initialRows, query]);

  return (
    <section className="cash-payment-card">
      <div className="cash-payment-toolbar">
        <h2>Daftar Pembayaran Kasbon</h2>
        <div className="cash-payment-filter-row">
          <label>
            <span>Filter Nama:</span>
            <span className="cash-payment-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama karyawan ..."
              />
            </span>
          </label>
          <label>
            <span>Atur Ulang Filter:</span>
            <button type="button" onClick={() => setQuery("")}>
              <RotateCcw size={15} aria-hidden="true" />
              ATUR ULANG
            </button>
          </label>
        </div>
      </div>

      {rows.length ? (
        <div className="cash-payment-table-wrap">
          <table className="cash-payment-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Kasbon Awal</th>
                <th>Cicilan</th>
                <th>Sudah Dibayar</th>
                <th>Sisa</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.employeeName}</strong><small>{row.employeeCode}</small></td>
                  <td>{money(row.amount)}</td>
                  <td>{money(row.installmentAmount)}</td>
                  <td>{money(row.paidAmount)}</td>
                  <td>{money(row.remainingAmount)}</td>
                  <td>{row.status === "Lunas" ? "—" : date(row.dueDate)}</td>
                  <td><span className={`cash-payment-status ${row.status === "Lunas" ? "paid" : "active"}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cash-payment-empty">
          <div className="cash-payment-empty-art" aria-hidden="true">
            <span />
            <Inbox size={44} />
          </div>
          <strong>Data Kosong</strong>
        </div>
      )}
    </section>
  );
}
