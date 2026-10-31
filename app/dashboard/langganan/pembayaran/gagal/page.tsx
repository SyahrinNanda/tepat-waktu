import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pembayaran Gagal" };

export default function Page() {
  redirect("/dashboard/langganan");
}
