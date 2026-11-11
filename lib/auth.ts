import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { INACTIVE_MEMBER_MESSAGE, isMemberInactive } from "@/lib/member-status";
import { reserveEmailSend, resetEmailSend, type EmailPurpose } from "@/lib/email-throttle";
import { sendAuthEmail, sendLoginOtpEmail } from "@/lib/registration/auth-emails";
import { provisionRegistration } from "@/lib/registration/provision";

/** Takes the resend turn for (purpose, email) or answers 429 with the remaining wait. */
async function throttleEmail(purpose: EmailPurpose, email: string) {
  const decision = await reserveEmailSend(purpose, email);
  if (!decision.allowed) throw new APIError("TOO_MANY_REQUESTS", { message: decision.message, code: "EMAIL_RESEND_COOLDOWN" });
}

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
    // The resend limit is taken in hooks.before for every address (so a 429 never reveals whether an account exists).
    sendResetPassword: async ({ user, url }) => sendAuthEmail("recovery", user.email, url),
    // The link did its job: the next request starts at the shortest wait again.
    onPasswordReset: async ({ user }) => { await resetEmailSend("password_reset", user.email); },
  },
  emailVerification: {
    // Off on purpose: company admins create employee accounts with signUpEmail and mark them
    // verified themselves. The public sign-up (/api/registration) sends the email explicitly.
    sendOnSignUp: false,
    // An unverified account that tries to log in gets a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }, request) => {
      // Resend button and sign-up go through hooks.before (429 with the wait). A login attempt of an
      // unverified account sends a link too: there the limit applies silently, the login answer stays the same.
      if (request?.url?.includes("/sign-in") && !(await reserveEmailSend("verification", user.email)).allowed) return;
      sendAuthEmail("signup", user.email, url);
    },
    afterEmailVerification: async (user) => {
      // Creates the company from the sign-up form. If it fails here, /masuk/lanjut retries it.
      await resetEmailSend("verification", user.email).catch(() => undefined);
      try { await provisionRegistration(user.id); }
      catch (error) { console.error("Ruang kerja belum dibuat setelah verifikasi:", error); }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  hooks: {
    // Escalating resend limit (1 min, 5 min, 1 h, 5 h, 24 h) on every endpoint that emails someone.
    before: createAuthMiddleware(async (ctx) => {
      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (ctx.path === "/request-password-reset" && email) await throttleEmail("password_reset", email);
      if (ctx.path === "/send-verification-email" && email) await throttleEmail("verification", email);
      if (ctx.path === "/two-factor/send-otp") {
        const userEmail = await twoFactorPendingEmail(ctx);
        if (userEmail) await throttleEmail("login_otp", userEmail);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Code accepted: the next login starts at the shortest wait again.
      if (ctx.path === "/two-factor/verify-otp" && ctx.context.newSession) await resetEmailSend("login_otp", ctx.context.newSession.user.email).catch(() => undefined);
    }),
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

/** Email of the user between the password step and the OTP step (Better Auth "two_factor" cookie). */
async function twoFactorPendingEmail(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]) {
  const cookie = ctx.context.createAuthCookie("two_factor");
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!identifier) return null;
  const pending = await ctx.context.internalAdapter.findVerificationValue(identifier);
  if (!pending) return null;
  const found = await ctx.context.internalAdapter.findUserById(pending.value);
  return found?.email ?? null;
}
