"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { resolveTimeZone } from "@/lib/timezone";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account, companyMembers, employees, session, user } from "@/db/schema";
import { ensureEmployeeRecord } from "@/features/attendance/server/employee-link";
import { employeeCapacity, employeeLimitMessage, seatLimitError } from "@/features/subscriptions/server/employee-capacity";

const isAdminRole = (role: string) => role === "admin" || role === "owner";
import { auth } from "@/lib/auth";
import { requireCompanyRole } from "@/lib/current-company";
import { revokeUserSessions } from "@/lib/member-status";
import { setOtpLogin } from "@/lib/otp-login";
import { createAndSendInvitation, InvitationError, invitationStatuses, unusablePassword } from "@/features/invitations/server/invitations";

export type RoleValue = "admin" | "general_manager" | "hrd" | "manager" | "employee";

const roleSchema = z.enum(["admin", "general_manager", "hrd", "manager", "employee"]);

export type CompanyUserData = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: RoleValue;
  roleLabel: string;
  isActive: boolean;
  isOtpLogin: boolean;
  lastLoginTime: string;
  lastLoginDate: string;
  createdAt: Date;
  /** Emailed invitation not used yet: "pending" (link valid) or "expired". */
  invitation: "pending" | "expired" | null;
};

function getRoleDisplay(role: string): string {
  switch (role) {
    case "owner":
    case "admin":
      return "Administrator";
    case "general_manager":
      return "General Manager";
    case "hrd":
      return "HRD";
    case "manager":
      return "Manager";
    case "employee":
      return "Karyawan / Staf";
    default:
      return role;
  }
}

export async function fetchCompanyUsers(): Promise<CompanyUserData[]> {
  const context = await requireCompanyRole(["admin"]);
  const tz = resolveTimeZone(context.timezone);

  const rows = await db
    .select({
      id: companyMembers.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: companyMembers.phone,
      role: companyMembers.role,
      isActive: companyMembers.isActive,
      isOtpLogin: companyMembers.isOtpLogin,
      lastLoginAt: companyMembers.lastLoginAt,
      createdAt: companyMembers.createdAt,
    })
    .from(companyMembers)
    .innerJoin(user, eq(companyMembers.userId, user.id))
    .where(eq(companyMembers.companyId, context.companyId))
    .orderBy(desc(companyMembers.createdAt));

  // Also query sessions to get real recent login times if lastLoginAt is not set
  const userIds = rows.map((r) => r.userId);
  const sessionMap = new Map<string, Date>();

  if (userIds.length > 0) {
    const userSessions = await db
      .select({
        userId: session.userId,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
      })
      .from(session)
      .where(inArray(session.userId, userIds))
      .orderBy(desc(session.updatedAt));

    for (const s of userSessions) {
      if (!sessionMap.has(s.userId)) {
        sessionMap.set(s.userId, s.updatedAt || s.createdAt);
      }
    }
  }

  const invitations = await invitationStatuses(context.companyId, userIds);

  // Also query employee phones if member phone is null
  const employeePhones = await db
    .select({
      userId: employees.userId,
      phone: employees.phone,
    })
    .from(employees)
    .where(eq(employees.companyId, context.companyId));

  const empPhoneMap = new Map<string, string>();
  for (const emp of employeePhones) {
    if (emp.userId && emp.phone) {
      empPhoneMap.set(emp.userId, emp.phone);
    }
  }

  return rows.map((row) => {
    const lastLogin =
      row.lastLoginAt || sessionMap.get(row.userId) || row.createdAt;

    const timeFormatter = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    });

    const dateFormatter = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    });

    const phone = row.phone || empPhoneMap.get(row.userId) || null;
    const roleValue = (row.role === "owner" ? "admin" : row.role) as RoleValue;

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone,
      role: roleValue,
      roleLabel: getRoleDisplay(row.role),
      isActive: row.isActive,
      isOtpLogin: row.isOtpLogin,
      lastLoginTime: timeFormatter.format(lastLogin),
      lastLoginDate: dateFormatter.format(lastLogin),
      createdAt: row.createdAt,
      invitation: invitations.get(row.userId) ?? null,
    };
  });
}

/**
 * Non-admin members get an employee record (they check in), which counts against the plan.
 * Linking an existing active employee with the same email does not add to the count.
 */
async function newEmployeeLimitError(companyId: string, email: string, role: string) {
  if (role === "admin" || role === "owner") return null;
  const [existing] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.email, email), eq(employees.status, "active"))).limit(1);
  if (existing) return null;
  const capacity = await employeeCapacity(companyId);
  return capacity.full ? employeeLimitMessage(capacity) : null;
}

/** One account belongs to at most one company (unique index on company_members.user_id). */
async function existingMembershipError(userId: string, companyId: string) {
  const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
  if (!membership) return null;
  return membership.companyId === companyId
    ? "Pengguna dengan email ini sudah terdaftar di perusahaan ini."
    : "Email ini sudah dipakai akun di perusahaan lain. Satu akun hanya bisa terhubung ke satu perusahaan, jadi gunakan email lain.";
}

export async function createCompanyUser(form: FormData) {
  const context = await requireCompanyRole(["admin"]);
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      phone: z.string().trim().max(30).optional(),
      role: roleSchema,
    })
    .parse(Object.fromEntries(form));

  const email = parsed.email.toLowerCase();
  const limitError = await newEmployeeLimitError(context.companyId, email, parsed.role);
  if (limitError) throw new Error(limitError);

  let [targetUser] = await db
    .select({ id: user.id, platformRole: user.platformRole })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (targetUser?.platformRole === "superadmin") {
    throw new Error("Akun Superadmin tidak dapat ditambahkan sebagai anggota perusahaan.");
  }

  if (targetUser) {
    const membershipError = await existingMembershipError(targetUser.id, context.companyId);
    if (membershipError) throw new Error(membershipError);
  } else {
    const created = await auth.api.signUpEmail({
      body: {
        name: parsed.name,
        email,
        password: parsed.password,
      },
    });
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.user.id));
    targetUser = { id: created.user.id, platformRole: "user" };
  }

  await db.insert(companyMembers).values({
    companyId: context.companyId,
    userId: targetUser.id,
    role: parsed.role,
    phone: parsed.phone ? parsed.phone.trim() : null,
    isActive: true,
    isOtpLogin: false,
    lastLoginAt: new Date(),
  });

  // Links an existing employee record by email, or creates one so non-admin roles can check in.
  await ensureEmployeeRecord({ companyId: context.companyId, userId: targetUser.id, name: parsed.name, email, role: parsed.role });

  revalidatePath("/dashboard/pengaturan/users");
  redirect("/dashboard/pengaturan/users");
}

export async function createCompanyUserAction(input: {
  name: string;
  email: string;
  phone?: string;
  /** Required unless sendInvite: then the user sets their own password from the emailed link. */
  password?: string;
  role: RoleValue;
  sendInvite?: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
        email: z.string().email("Format email tidak valid."),
        password: z.string().max(128).optional(),
        phone: z.string().trim().max(30).optional(),
        role: roleSchema,
        sendInvite: z.boolean().optional(),
      })
      .parse(input);
    const sendInvite = parsed.sendInvite === true;
    if (!sendInvite && (parsed.password ?? "").length < 8) return { ok: false, error: "Password minimal 8 karakter." };

    const email = parsed.email.toLowerCase();
    const limitError = await newEmployeeLimitError(context.companyId, email, parsed.role);
    if (limitError) return { ok: false, error: limitError };

    let [targetUser] = await db
      .select({ id: user.id, platformRole: user.platformRole })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (targetUser?.platformRole === "superadmin") {
      return {
        ok: false,
        error: "Akun Superadmin tidak dapat ditambahkan sebagai anggota perusahaan.",
      };
    }

    if (targetUser) {
      const membershipError = await existingMembershipError(targetUser.id, context.companyId);
      if (membershipError) return { ok: false, error: membershipError };
    } else {
      const created = await auth.api.signUpEmail({
        body: {
          name: parsed.name,
          email,
          // Invited users get a random password nobody knows; they set their own from the link.
          password: sendInvite ? unusablePassword() : parsed.password!,
        },
      });
      await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.user.id));
      targetUser = { id: created.user.id, platformRole: "user" };
    }

    await db.insert(companyMembers).values({
      companyId: context.companyId,
      userId: targetUser.id,
      role: parsed.role,
      phone: parsed.phone ? parsed.phone.trim() : null,
      isActive: true,
      isOtpLogin: false,
      lastLoginAt: new Date(),
    });

    // Links an existing employee record by email, or creates one so non-admin roles can check in.
    await ensureEmployeeRecord({ companyId: context.companyId, userId: targetUser.id, name: parsed.name, email, role: parsed.role });

    revalidatePath("/dashboard/pengaturan/users");
    if (sendInvite) {
      const sent = await createAndSendInvitation({
        companyId: context.companyId, userId: targetUser.id, email, name: parsed.name, roleLabel: getRoleDisplay(parsed.role),
        invitedBy: context.session.user.id, inviterName: context.session.user.name,
      }).catch((error) => (error instanceof InvitationError ? error.message : false));
      if (typeof sent === "string") return { ok: true, message: `User ditambahkan, tetapi undangan belum dikirim: ${sent}` };
      return sent
        ? { ok: true, message: `User ditambahkan. Email undangan dikirim ke ${email}; tautannya berlaku 7 hari.` }
        : { ok: true, message: "User ditambahkan, tetapi email undangan gagal dikirim. Coba lagi lewat menu ⋮ → Kirim ulang undangan." };
    }
    return { ok: true, message: "User berhasil ditambahkan." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menambahkan user.";
    return { ok: false, error: msg };
  }
}

export async function updateCompanyUserAction(input: {
  memberId: string;
  name: string;
  phone?: string;
  role: RoleValue;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        memberId: z.string().uuid(),
        name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
        phone: z.string().trim().max(30).optional(),
        role: roleSchema,
      })
      .parse(input);

    const [member] = await db
      .select({ id: companyMembers.id, userId: companyMembers.userId, role: companyMembers.role, email: user.email })
      .from(companyMembers)
      .innerJoin(user, eq(user.id, companyMembers.userId))
      .where(
        and(
          eq(companyMembers.id, parsed.memberId),
          eq(companyMembers.companyId, context.companyId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, error: "Pengguna tidak ditemukan." };

    if (member.userId === context.session.user.id && parsed.role !== "admin") {
      return {
        ok: false,
        error: "Anda tidak dapat mencabut akses Administrator milik sendiri.",
      };
    }

    // An Administrator does not use a plan seat; turning one into another role does.
    const becomesSeat = isAdminRole(member.role) && !isAdminRole(parsed.role);
    if (becomesSeat) {
      const limitError = await seatLimitError(context.companyId, member.userId);
      if (limitError) return { ok: false, error: limitError };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ name: parsed.name, updatedAt: new Date() })
        .where(eq(user.id, member.userId));

      await tx
        .update(companyMembers)
        .set({
          role: parsed.role,
          phone: parsed.phone ? parsed.phone.trim() : null,
        })
        .where(eq(companyMembers.id, member.id));
    });
    // Non-admin roles check in, so they need an employee record (counted against the plan).
    if (becomesSeat) await ensureEmployeeRecord({ companyId: context.companyId, userId: member.userId, name: parsed.name, email: member.email, role: parsed.role });

    revalidatePath("/dashboard/pengaturan/users");
    return { ok: true, message: "Data user berhasil diperbarui." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui user.";
    return { ok: false, error: msg };
  }
}

export async function updateUserPasswordAction(input: {
  memberId: string;
  newPassword: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        memberId: z.string().uuid(),
        newPassword: z.string().min(8, "Password minimal 8 karakter.").max(128),
      })
      .parse(input);

    const [member] = await db
      .select({ id: companyMembers.id, userId: companyMembers.userId })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.id, parsed.memberId),
          eq(companyMembers.companyId, context.companyId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, error: "Pengguna tidak ditemukan." };

    const hashedPassword = await hashPassword(parsed.newPassword);

    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, member.userId),
          eq(account.providerId, "credential"),
        ),
      );

    revalidatePath("/dashboard/pengaturan/users");
    return { ok: true, message: "Password user berhasil diperbarui." };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Gagal memperbarui password user.";
    return { ok: false, error: msg };
  }
}

export async function toggleUserStatusAction(input: {
  memberId: string;
  isActive: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        memberId: z.string().uuid(),
        isActive: z.boolean(),
      })
      .parse(input);

    const [member] = await db
      .select({ id: companyMembers.id, userId: companyMembers.userId, role: companyMembers.role, isActive: companyMembers.isActive })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.id, parsed.memberId),
          eq(companyMembers.companyId, context.companyId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, error: "Pengguna tidak ditemukan." };

    if (member.userId === context.session.user.id && !parsed.isActive) {
      return {
        ok: false,
        error: "Anda tidak dapat menonaktifkan status akun sendiri.",
      };
    }

    if ((member.role === "admin" || member.role === "owner") && !context.isSuperAdmin) {
      return { ok: false, error: "Status akun Administrator hanya bisa diubah oleh Superadmin TepatWaktu." };
    }

    // Re-activating a non-admin login takes a plan seat again.
    if (parsed.isActive && !member.isActive && !isAdminRole(member.role)) {
      const limitError = await seatLimitError(context.companyId, member.userId);
      if (limitError) return { ok: false, error: limitError };
    }

    await db
      .update(companyMembers)
      .set({ isActive: parsed.isActive })
      .where(eq(companyMembers.id, member.id));
    // Deactivated: sign out of every device right away (new logins are refused in lib/auth.ts).
    if (!parsed.isActive) await revokeUserSessions(member.userId);

    revalidatePath("/dashboard/pengaturan/users");
    return { ok: true, message: parsed.isActive ? "Pengguna diaktifkan dan bisa login kembali." : "Pengguna dinonaktifkan: langsung keluar dari semua perangkat dan tidak bisa login." };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Gagal mengubah status pengguna.";
    return { ok: false, error: msg };
  }
}

export async function toggleUserOtpAction(input: {
  memberId: string;
  isOtpLogin: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        memberId: z.string().uuid(),
        isOtpLogin: z.boolean(),
      })
      .parse(input);

    const [member] = await db
      .select({ id: companyMembers.id, userId: companyMembers.userId })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.id, parsed.memberId),
          eq(companyMembers.companyId, context.companyId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, error: "Pengguna tidak ditemukan." };

    // Syncs Better Auth's two-factor state (user flag + two_factor row) with the switch.
    await setOtpLogin(member.id, member.userId, parsed.isOtpLogin);

    revalidatePath("/dashboard/pengaturan/users");
    return { ok: true, message: parsed.isOtpLogin ? "OTP Login aktif: user akan diminta kode yang dikirim ke email setiap kali login." : "OTP Login dimatikan untuk user ini." };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Gagal mengubah pengaturan OTP.";
    return { ok: false, error: msg };
  }
}

export async function deleteCompanyUserAction(input: {
  memberId: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const parsed = z
      .object({
        memberId: z.string().uuid(),
      })
      .parse(input);

    const [member] = await db
      .select({
        id: companyMembers.id,
        userId: companyMembers.userId,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.id, parsed.memberId),
          eq(companyMembers.companyId, context.companyId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, error: "Pengguna tidak ditemukan." };

    if (member.userId === context.session.user.id) {
      return { ok: false, error: "Anda tidak dapat menghapus akun sendiri." };
    }

    if (["admin", "owner"].includes(member.role)) {
      const admins = await db
        .select({ id: companyMembers.id })
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, context.companyId),
            eq(companyMembers.role, "admin"),
          ),
        );
      const owners = await db
        .select({ id: companyMembers.id })
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, context.companyId),
            eq(companyMembers.role, "owner"),
          ),
        );
      if (admins.length + owners.length <= 1 && !context.isSuperAdmin) {
        return {
          ok: false,
          error: "Perusahaan harus memiliki minimal satu Administrator.",
        };
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(employees)
        .set({ userId: null })
        .where(
          and(
            eq(employees.companyId, context.companyId),
            eq(employees.userId, member.userId),
          ),
        );
      await tx
        .delete(companyMembers)
        .where(
          and(
            eq(companyMembers.id, member.id),
            eq(companyMembers.companyId, context.companyId),
          ),
        );
    });

    revalidatePath("/dashboard/pengaturan/users");
    return { ok: true, message: "User berhasil dihapus." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus user.";
    return { ok: false, error: msg };
  }
}

// Retained for backward compatibility with [id]/page.tsx
export async function updateCompanyUserRole(form: FormData) {
  const context = await requireCompanyRole(["admin"]);
  const parsed = z
    .object({ memberId: z.string().uuid(), role: roleSchema })
    .parse(Object.fromEntries(form));
  const [member] = await db
    .select({ id: companyMembers.id, userId: companyMembers.userId, role: companyMembers.role, email: user.email, name: user.name })
    .from(companyMembers)
    .innerJoin(user, eq(user.id, companyMembers.userId))
    .where(
      and(
        eq(companyMembers.id, parsed.memberId),
        eq(companyMembers.companyId, context.companyId),
      ),
    )
    .limit(1);
  if (!member) throw new Error("Pengguna tidak ditemukan.");
  if (member.userId === context.session.user.id && parsed.role !== "admin") {
    throw new Error("Anda tidak dapat mencabut akses Admin milik sendiri.");
  }
  // An Administrator does not use a plan seat; turning one into another role does.
  const becomesSeat = isAdminRole(member.role) && !isAdminRole(parsed.role);
  if (becomesSeat) {
    const limitError = await seatLimitError(context.companyId, member.userId);
    if (limitError) throw new Error(limitError);
  }
  await db
    .update(companyMembers)
    .set({ role: parsed.role })
    .where(
      and(
        eq(companyMembers.id, member.id),
        eq(companyMembers.companyId, context.companyId),
      ),
    );
  if (becomesSeat) await ensureEmployeeRecord({ companyId: context.companyId, userId: member.userId, name: member.name, email: member.email, role: parsed.role });
  revalidatePath("/dashboard/pengaturan/users");
  revalidatePath(`/dashboard/pengaturan/users/${member.id}`);
}

export async function removeCompanyUser(form: FormData) {
  const context = await requireCompanyRole(["admin"]);
  const { memberId } = z
    .object({ memberId: z.string().uuid() })
    .parse(Object.fromEntries(form));
  const [member] = await db
    .select({
      id: companyMembers.id,
      userId: companyMembers.userId,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.id, memberId),
        eq(companyMembers.companyId, context.companyId),
      ),
    )
    .limit(1);
  if (!member) throw new Error("Pengguna tidak ditemukan.");
  if (member.userId === context.session.user.id) {
    throw new Error("Anda tidak dapat mencabut akses akun sendiri.");
  }
  if (["admin", "owner"].includes(member.role)) {
    const admins = await db
      .select({ id: companyMembers.id })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, context.companyId),
          eq(companyMembers.role, "admin"),
        ),
      );
    const owners = await db
      .select({ id: companyMembers.id })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, context.companyId),
          eq(companyMembers.role, "owner"),
        ),
      );
    if (admins.length + owners.length <= 1 && !context.isSuperAdmin) {
      throw new Error("Perusahaan harus memiliki minimal satu Admin.");
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(employees)
      .set({ userId: null })
      .where(
        and(
          eq(employees.companyId, context.companyId),
          eq(employees.userId, member.userId),
        ),
      );
    await tx
      .delete(companyMembers)
      .where(
        and(
          eq(companyMembers.id, member.id),
          eq(companyMembers.companyId, context.companyId),
        ),
      );
  });
  revalidatePath("/dashboard/pengaturan/users");
  redirect("/dashboard/pengaturan/users");
}

/** Sends a fresh invitation link (the previous one stops working). Only for users who have not used an invitation yet. */
export async function resendInvitationAction(input: { memberId: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const context = await requireCompanyRole(["admin"]);
    const memberId = z.string().uuid().parse(input.memberId);
    const [member] = await db.select({ userId: companyMembers.userId, role: companyMembers.role, name: user.name, email: user.email })
      .from(companyMembers).innerJoin(user, eq(user.id, companyMembers.userId))
      .where(and(eq(companyMembers.id, memberId), eq(companyMembers.companyId, context.companyId))).limit(1);
    if (!member) return { ok: false, error: "User tidak ditemukan." };
    const status = (await invitationStatuses(context.companyId, [member.userId])).get(member.userId);
    if (!status) return { ok: false, error: "User ini sudah membuat password atau tidak diundang lewat email. Gunakan Ubah Password bila perlu." };
    const sent = await createAndSendInvitation({
      companyId: context.companyId, userId: member.userId, email: member.email, name: member.name, roleLabel: getRoleDisplay(member.role),
      invitedBy: context.session.user.id, inviterName: context.session.user.name,
    });
    revalidatePath("/dashboard/pengaturan/users");
    return sent ? { ok: true, message: `Undangan baru dikirim ke ${member.email}. Tautan lama tidak berlaku lagi.` } : { ok: false, error: "Email undangan gagal dikirim. Coba lagi beberapa saat lagi." };
  } catch (err) {
    return { ok: false, error: err instanceof InvitationError ? err.message : "Gagal mengirim ulang undangan." };
  }
}
