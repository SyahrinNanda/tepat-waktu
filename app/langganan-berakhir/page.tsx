import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCompany, SUBSCRIPTION_RENEW_PATH } from "@/lib/current-company";
import { SubscriptionLocked } from "@/features/subscriptions/components/subscription-locked";

export const metadata: Metadata = { title: "Masa Aktif Berakhir" };

export default async function Page() {
  const context = await requireCompany({ allowExpired: true });
  if (context.subscription.state !== "expired") redirect("/dashboard");
  if (context.isSuperAdmin || context.role === "admin" || context.role === "owner") redirect(`${SUBSCRIPTION_RENEW_PATH}?expired=1`);
  return <SubscriptionLocked companyName={context.companyName} userName={context.session.user.name} planName={context.subscription.planName} endsAt={context.subscription.endsAt} timezone={context.timezone} />;
}
