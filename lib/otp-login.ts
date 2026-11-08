import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { symmetricEncrypt } from "better-auth/crypto";
import { db } from "@/db";
import { companyMembers, twoFactor, user } from "@/db/schema";
import { auth } from "@/lib/auth";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Turns "OTP Login" on/off for a member. Better Auth's twoFactor plugin asks for an emailed code
 * after the password when user.twoFactorEnabled is true, and its sign-in OTP check also needs a
 * two_factor row (it tracks failed attempts and lockouts there). The row is created here the way
 * /two-factor/enable would, but without TOTP (disabled) and with no backup codes, so the emailed
 * code is the only second factor.
 */
export async function setOtpLogin(memberId: string, userId: string, enabled: boolean) {
  const secretConfig = enabled ? (await auth.$context).secretConfig : null;
  const encryptedSecret = secretConfig ? await symmetricEncrypt({ key: secretConfig, data: randomBytes(20).toString("hex") }) : null;
  await db.transaction(async (tx: Tx) => {
    await tx.update(companyMembers).set({ isOtpLogin: enabled }).where(eq(companyMembers.id, memberId));
    await tx.update(user).set({ twoFactorEnabled: enabled }).where(eq(user.id, userId));
    if (!enabled) {
      await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
      return;
    }
    const [existing] = await tx.select({ id: twoFactor.id }).from(twoFactor).where(eq(twoFactor.userId, userId)).limit(1);
    if (!existing) {
      await tx.insert(twoFactor).values({ id: randomUUID(), userId, secret: encryptedSecret!, backupCodes: "[]", verified: true, failedVerificationCount: 0 });
    }
  });
}
