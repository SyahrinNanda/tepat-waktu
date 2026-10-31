import { eq } from "drizzle-orm";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function LoginRedirectPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [account] = await db
    .select({ platformRole: user.platformRole })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  redirect((account?.platformRole === "superadmin" ? "/superadmin" : "/dashboard") as Route);
}
