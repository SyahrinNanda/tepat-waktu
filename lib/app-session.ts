import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getAppSession(requestHeaders?: Headers) {
  return auth.api.getSession({ headers: requestHeaders ?? await headers() });
}
