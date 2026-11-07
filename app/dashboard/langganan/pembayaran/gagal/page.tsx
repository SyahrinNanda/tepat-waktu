import type { Metadata } from "next";
import { PaymentResultPage } from "@/features/subscriptions/pages/payment-result-page";

export const metadata: Metadata = { title: "Pembayaran Gagal" };

export default async function Page({ searchParams }: { searchParams: Promise<{ invoice?: string; aktif?: string }> }) {
  const { invoice, aktif } = await searchParams;
  return <PaymentResultPage invoiceId={invoice} failed justActivated={aktif === "1"} />;
}
