import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, session } from "@/db/schema";

export const INACTIVE_MEMBER_MESSAGE = "Akun Anda dinonaktifkan oleh admin perusahaan. Hubungi admin perusahaan Anda untuk mengaktifkannya kembali.";

/**
 * True when the user is a company member whose status (Pengaturan → Users → Status) is off.
 * Users without a membership (superadmins, accounts mid-registration) are never "inactive".
 */
export async function isMemberInactive(userId: string) {
  const [membership] = await db.select({ isActive: companyMembers.isActive }).from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
  return membership ? !membership.isActive : false;
}

/** Signs the user out everywhere (used when an account is deactivated). */
export async function revokeUserSessions(userId: string) {
  await db.delete(session).where(eq(session.userId, userId));
}
