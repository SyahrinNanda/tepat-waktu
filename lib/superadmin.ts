import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getAppSession } from "@/lib/app-session";

export async function requireSuperAdmin() {
  const session = await getAppSession();
  if (!session) redirect("/");

  const [account] = await db
    .select({ platformRole: user.platformRole })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (account?.platformRole !== "superadmin") redirect("/dashboard");
  return session;
}
