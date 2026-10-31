import type { Metadata } from "next";
import Link from "next/link";
import { CashAdvancePaymentManager } from "@/features/cash-advance-payments/components/cash-advance-payment-manager";
import { listCashAdvancePayments } from "@/features/cash-advance-payments/server/payment-service";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Pembayaran Kasbon" };

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const rows = await listCashAdvancePayments(context.companyId);

  return (
    <div className="cash-payment-page">
      <header className="cash-payment-header">
        <small>Presensi Admin Panel</small>
        <h1>DAFTAR PEMBAYARAN KASBON</h1>
        <nav aria-label="Breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span>/</span>
          <span>Pembayaran Kasbon</span>
          <span>/</span>
          <span>Daftar Pembayaran Kasbon</span>
        </nav>
      </header>
      <CashAdvancePaymentManager initialRows={rows} />
    </div>
  );
}
