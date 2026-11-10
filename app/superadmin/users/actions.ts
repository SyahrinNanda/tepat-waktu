"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account, companies, companyMembers, user } from "@/db/schema";
import { revokeUserSessions } from "@/lib/member-status";
import { seatLimitError } from "@/features/subscriptions/server/employee-capacity";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";

export async function updateUserPlatformRole(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().parse(formData.get("userId"));
  const newRole = z.enum(["user", "superadmin"]).parse(formData.get("platformRole"));

  if (userId === currentSession.user.id && newRole !== "superadmin") {
    throw new Error("Anda tidak dapat mencabut hak Super Admin dari akun Anda sendiri.");
  }

  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  await db.update(user).set({ platformRole: newRole }).where(eq(user.id, userId));
  await recordAudit(currentSession, { action: "user.role_update", summary: `Peran ${target?.email ?? userId} diubah ke ${newRole === "superadmin" ? "Super Admin" : "User"}`, metadata: { userId, newRole } });
  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin");
}

export async function resetUserPassword(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().parse(formData.get("userId"));
  const newPassword = z.string().min(6, "Password minimal 6 karakter.").parse(formData.get("newPassword"));

  const hashedPassword = await hashPassword(newPassword);

  const [existingAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);

  if (existingAccount) {
    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(account.id, existingAccount.id));
  } else {
    // If user account row for credential doesn't exist yet, insert it
    const [targetUser] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
    if (!targetUser) throw new Error("Pengguna tidak ditemukan.");

    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: targetUser.email,
      providerId: "credential",
      userId,
      password: hashedPassword,
    });
  }

  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  await recordAudit(currentSession, { action: "user.password_reset", summary: `Mereset password ${target?.email ?? userId}`, metadata: { userId } });
  revalidatePath("/superadmin/users");
}

export async function deleteUserAccount(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().parse(formData.get("userId"));

  if (userId === currentSession.user.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
  }

  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  // Logged first: the entry keeps the email after the account row is gone.
  await recordAudit(currentSession, { action: "user.delete", summary: `Menghapus akun ${target?.email ?? userId}`, metadata: { userId, email: target?.email } });
  await db.delete(user).where(eq(user.id, userId));
  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin");
}


/** Superadmin: activate/deactivate a company member (the only way to change an Administrator's status). */
export async function setMemberStatus(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().min(1).parse(formData.get("userId"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  const [member] = await db.select({ id: companyMembers.id, role: companyMembers.role, isActive: companyMembers.isActive, companyId: companyMembers.companyId, companyName: companies.name, email: user.email })
    .from(companyMembers).innerJoin(user, eq(user.id, companyMembers.userId)).innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, userId)).limit(1);
  if (!member) throw new Error("Akun ini tidak terhubung ke perusahaan mana pun.");
  // Re-activating a non-admin login takes a plan seat again (the plan limits non-admin logins).
  if (active && !member.isActive && member.role !== "admin" && member.role !== "owner") {
    const limitError = await seatLimitError(member.companyId, userId);
    if (limitError) throw new Error(limitError);
  }
  await db.update(companyMembers).set({ isActive: active }).where(eq(companyMembers.id, member.id));
  if (!active) await revokeUserSessions(userId);
  await recordAudit(currentSession, {
    action: active ? "user.activate" : "user.deactivate", companyId: member.companyId,
    summary: `${active ? "Mengaktifkan" : "Menonaktifkan"} akun ${member.email} (${member.role === "admin" || member.role === "owner" ? "Administrator" : member.role}) di ${member.companyName}`,
    metadata: { userId, role: member.role, active },
  });
  revalidatePath("/superadmin/users");
}
