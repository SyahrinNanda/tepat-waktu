import type { Metadata } from "next";
import { VerificationEmailView } from "@/components/verification-email-view";
import { getEmailResendWaitSeconds } from "@/lib/email-send-cooldown";

export const metadata: Metadata = { title: "Verifikasi Email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  const initialWaitSeconds = email ? await getEmailResendWaitSeconds(email) : 0;
  return <VerificationEmailView email={email} initialWaitSeconds={initialWaitSeconds}/>;
}
