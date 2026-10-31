"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function updateUserPlatformRole(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().parse(formData.get("userId"));
  const newRole = z.enum(["user", "superadmin"]).parse(formData.get("platformRole"));

  if (userId === currentSession.user.id && newRole !== "superadmin") {
    throw new Error("Anda tidak dapat mencabut hak Super Admin dari akun Anda sendiri.");
  }

  await db.update(user).set({ platformRole: newRole }).where(eq(user.id, userId));
  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin");
}

export async function resetUserPassword(formData: FormData) {
  await requireSuperAdmin();
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

  revalidatePath("/superadmin/users");
}

export async function deleteUserAccount(formData: FormData) {
  const currentSession = await requireSuperAdmin();
  const userId = z.string().parse(formData.get("userId"));

  if (userId === currentSession.user.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
  }

  await db.delete(user).where(eq(user.id, userId));
  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin");
}

