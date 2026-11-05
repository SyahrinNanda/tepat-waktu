import { eq } from "drizzle-orm";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getAppSession } from "@/lib/app-session";
import { provisionRegistration } from "@/lib/registration/provision";

export default async function LoginRedirectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  // A verification link resent at login comes back here; show expired/invalid links properly.
  if (error) redirect(`/verifikasi-email/berhasil?error=${encodeURIComponent(error)}` as Route);
  const session = await getAppSession();
  if (!session) redirect("/");

  // Safety net: create the company from the sign-up form if that did not happen at verification.
  try { await provisionRegistration(session.user.id); }
  catch (failure) { console.error("Ruang kerja belum dapat dibuat saat login:", failure); }

  const [account] = await db
    .select({ platformRole: user.platformRole })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  redirect((account?.platformRole === "superadmin" ? "/superadmin" : "/dashboard") as Route);
}
