import type { Metadata } from "next";
import { VerificationEmailView } from "@/components/verification-email-view";

export const metadata: Metadata = { title: "Verifikasi Email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return <VerificationEmailView email={email}/>;
}
