"use server";

import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { account, companyMembers, employees, session, user, userInvitations } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail } from "@/lib/registration/auth-emails";

export type EmployeePasswordState = { status: "idle" | "success" | "error"; message?: string };

/**
 * "Ganti Password" on the employee edit page: an admin/GM/HRD sets a new login password for the
 * employee's account. All of the employee's sessions are signed out, a pending invitation link is
 * closed, and the employee is told by email. Admin/owner accounts and superadmins are never touched
 * here, and only the company admin may reset the password of a GM or HRD account.
 */
export async function setEmployeePassword(_previous: EmployeePasswordState, form: FormData): Promise<EmployeePasswordState> {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const employeeId = String(form.get("employeeId") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 128) return { status: "error", message: "Password harus 8–128 karakter." };
  if (password !== confirmation) return { status: "error", message: "Konfirmasi password tidak sama." };

  const [target] = await db.select({ userId: employees.userId, name: employees.name, email: user.email, platformRole: user.platformRole, role: companyMembers.role })
    .from(employees)
    .innerJoin(user, eq(user.id, employees.userId))
    .leftJoin(companyMembers, and(eq(companyMembers.userId, employees.userId), eq(companyMembers.companyId, employees.companyId)))
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!target?.userId) return { status: "error", message: "Karyawan ini belum punya akun login. Kirim undangan dari halaman detail karyawan." };
  if (!target.role) return { status: "error", message: "Akun login karyawan tidak terdaftar di perusahaan ini." };
  if (target.platformRole === "superadmin" || ["owner", "admin"].includes(target.role)) return { status: "error", message: "Password akun Admin Perusahaan tidak bisa diganti dari sini. Gunakan Lupa password di halaman login." };
  if (context.role !== "admin" && ["general_manager", "hrd"].includes(target.role)) return { status: "error", message: "Hanya Admin Perusahaan yang bisa mengganti password akun General Manager atau HRD." };
  if (target.userId === context.session.user.id) return { status: "error", message: "Untuk akun Anda sendiri, ganti password lewat menu Pengaturan → Profile." };

  const userId = target.userId;
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await db.transaction(async (tx) => {
    const updated = await tx.update(account).set({ password: passwordHash, updatedAt: now })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential"))).returning({ id: account.id });
    if (!updated.length) await tx.insert(account).values({ id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash, createdAt: now, updatedAt: now });
    // The admin entered this email when adding the employee; a still-open invitation link is closed.
    await tx.update(user).set({ emailVerified: true, updatedAt: now }).where(eq(user.id, userId));
    await tx.update(userInvitations).set({ acceptedAt: now }).where(and(eq(userInvitations.userId, userId), isNull(userInvitations.acceptedAt)));
    await tx.delete(session).where(eq(session.userId, userId));
  });

  const email = renderBrandedEmail({
    subject: "Password akun TepatWaktu Anda diganti",
    eyebrow: "Keamanan akun",
    title: "Password Anda telah diganti",
    body: `Halo ${target.name}, password akun TepatWaktu Anda (${target.email}) baru saja diganti oleh ${context.session.user.name} dari ${context.companyName}. Anda telah dikeluarkan dari semua perangkat. Masuk kembali memakai password baru yang diberikan admin perusahaan Anda.`,
    note: "Jika Anda tidak meminta perubahan ini, segera hubungi admin perusahaan Anda.",
  });
  // Sent after the response so a slow mail provider never delays the admin's confirmation.
  after(() => sendMail({ to: [target.email], ...email }).then(() => undefined).catch((error) => console.error("Email pemberitahuan ganti password gagal dikirim:", error instanceof Error ? error.message : error)));

  revalidatePath("/dashboard/karyawan");
  revalidatePath(`/dashboard/karyawan/${employeeId}`);
  return { status: "success", message: `Password ${target.name} berhasil diganti. Karyawan telah dikeluarkan dari semua perangkat dan menerima email pemberitahuan.` };
}
