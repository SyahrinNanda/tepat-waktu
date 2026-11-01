"use client";

import { createAuthClient } from "better-auth/react";
import { supabaseAuthEnabled, supabaseBrowser } from "@/lib/supabase/client";

// The auth handler lives on this Next.js app, so a relative same-origin URL is
// safer than pinning the browser to a hostname or development port.
export const authClient = createAuthClient();

export const { signIn, signUp, useSession } = authClient;

export async function signOut() {
  try {
    if (supabaseAuthEnabled()) await supabaseBrowser().auth.signOut();
  } finally {
    await authClient.signOut();
  }
}
