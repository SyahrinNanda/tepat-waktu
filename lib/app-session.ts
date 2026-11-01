import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { supabaseServer, supabaseServerConfigured } from "@/lib/supabase/server";

export async function getAppSession(requestHeaders?: Headers) {
  const hasSupabaseCookie = (await cookies()).getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
  if (supabaseServerConfigured() && hasSupabaseCookie) {
    const client = await supabaseServer();
    const { data: { user: identity }, error } = await client.auth.getUser();
    if (!error && identity?.email && identity.email_confirmed_at) {
      const [account] = await db.select({ id: user.id, name: user.name, email: user.email })
        .from(user).where(eq(user.email, identity.email.toLowerCase())).limit(1);
      if (account) return { user: account };
    }
  }
  return auth.api.getSession({ headers: requestHeaders ?? await headers() });
}
