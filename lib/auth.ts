import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { INACTIVE_MEMBER_MESSAGE, isMemberInactive } from "@/lib/member-status";
import { sendAuthEmail, sendLoginOtpEmail } from "@/lib/registration/auth-emails";
import { provisionRegistration } from "@/lib/registration/provision";

const configuredOrigins = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
  (origin): origin is string => Boolean(origin),
);
const developmentOrigins =
  process.env.NODE_ENV === "development"
    ? ["http://localhost:*", "http://127.0.0.1:*"]
    : [];

/**
 * Accounts, sessions, email verification and password reset all live in this app's PostgreSQL.
 * Emails go through lib/mailer.ts (fallback in MAIL_PROVIDERS order, production: Mailjet → Mailtrap → Brevo).
 */
export const auth = betterAuth({
  appName: "TepatWaktu",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => sendAuthEmail("recovery", user.email, url),
  },
  emailVerification: {
    // Off on purpose: company admins create employee accounts with signUpEmail and mark them
    // verified themselves. The public sign-up (/api/registration) sends the email explicitly.
    sendOnSignUp: false,
    // An unverified account that tries to log in gets a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => sendAuthEmail("signup", user.email, url),
    afterEmailVerification: async (user) => {
      // Creates the company from the sign-up form. If it fails here, /masuk/lanjut retries it.
      try { await provisionRegistration(user.id); }
      catch (error) { console.error("Ruang kerja belum dibuat setelah verifikasi:", error); }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    session: {
      create: {
        // Members switched off by their company (Pengaturan → Users → Status) cannot start a session:
        // covers password login, the OTP step and auto sign-in after email verification.
        before: async (newSession) => {
          if (await isMemberInactive(newSession.userId)) throw new APIError("FORBIDDEN", { message: INACTIVE_MEMBER_MESSAGE, code: "ACCOUNT_DISABLED" });
        },
      },
    },
  },
  plugins: [
    // "OTP Login" (Pengaturan → Users): users with user.twoFactorEnabled get a 6-digit code by email
    // after the password step. TOTP apps are not offered.
    twoFactor({
      issuer: "TepatWaktu",
      totpOptions: { disable: true },
      otpOptions: {
        period: 5,
        storeOTP: "hashed",
        sendOTP: async ({ user, otp }) => sendLoginOtpEmail(user.email, otp),
      },
    }),
  ],
  trustedOrigins: [...new Set([...configuredOrigins, ...developmentOrigins])],
  // Login rate limiting keys on the client IP. Read it from the header our proxy sets (see
  // lib/client-ip.ts), not the client-controlled left-most X-Forwarded-For entry.
  advanced: { ipAddress: { ipAddressHeaders: [(process.env.CLIENT_IP_HEADER || "x-real-ip").toLowerCase()] } },
});
