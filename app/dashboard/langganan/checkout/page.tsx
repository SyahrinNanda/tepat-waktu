import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pilih Paket" };
export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  redirect(plan ? `/dashboard/langganan/paket?plan=${plan}` : "/dashboard/langganan/paket");
}
