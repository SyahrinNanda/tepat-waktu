"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// The auth handler lives on this Next.js app, so a relative same-origin URL is
// safer than pinning the browser to a hostname or development port.
// twoFactorClient adds authClient.twoFactor.sendOtp/verifyOtp; the login form handles the redirect itself.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });

export const { signIn, signUp, signOut, useSession } = authClient;
