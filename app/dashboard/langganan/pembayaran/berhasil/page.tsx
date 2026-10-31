import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pembayaran Berhasil" };

export default function Page() {
  redirect("/dashboard/langganan");
}
