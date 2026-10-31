"use client";

import { createAuthClient } from "better-auth/react";

// The auth handler lives on this Next.js app, so a relative same-origin URL is
// safer than pinning the browser to a hostname or development port.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
