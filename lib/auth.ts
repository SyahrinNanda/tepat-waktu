import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const configuredOrigins = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
  (origin): origin is string => Boolean(origin),
);
const developmentOrigins =
  process.env.NODE_ENV === "development"
    ? ["http://localhost:*", "http://127.0.0.1:*"]
    : [];

export const auth = betterAuth({
  appName: "TepatWaktu",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    expiresIn: 60 * 30,
    sendVerificationEmail: async () => {
      throw new Error("Akun lama belum diverifikasi. Hubungi administrator.");
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          disableSignUp: true,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [...new Set([...configuredOrigins, ...developmentOrigins])],
});
