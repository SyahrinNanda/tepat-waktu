import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isMemberInactive } from "@/lib/member-status";

/**
 * The signed-in session, or null. A member deactivated by their company (Status off) is treated as
 * signed out on every page and API, even if an old session cookie is still around.
 */
export async function getAppSession(requestHeaders?: Headers) {
  const current = await auth.api.getSession({ headers: requestHeaders ?? await headers() });
  if (current && await isMemberInactive(current.user.id)) return null;
  return current;
}
