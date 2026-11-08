import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, employees, user, userInvitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createAndSendInvitation, InvitationError, invitationStatuses, unusablePassword } from "./invitations";

/** Login account state of an employee record, as shown in the employee list and detail page. */
export type EmployeeAccountStatus = "active" | "pending" | "expired" | "none";

/**
 * Outcome of creating/inviting the login account for an employee. Passed in the URL (?akun=...)
 * so the employee detail page can explain what happened.
 */
export type EmployeeAccountOutcome =
  | "invited" | "resent" | "email_failed" | "linked" | "already_active" | "cooldown"
  | "other_company" | "superadmin" | "linked_elsewhere" | "inactive";

export async function employeeAccountStatuses(companyId: string, rows: { id: string; userId: string | null }[]) {
  const map = new Map<string, EmployeeAccountStatus>();
  const userIds = rows.flatMap((row) => (row.userId ? [row.userId] : []));
  const invitations = await invitationStatuses(companyId, userIds);
  for (const row of rows) map.set(row.id, !row.userId ? "none" : invitations.get(row.userId) ?? "active");
  return map;
}

const roleLabel = "Karyawan / Staf";

/**
 * Makes sure an active employee record has a login account and sends the invitation email:
 * - already linked and still invited -> sends a fresh invitation;
 * - no account for the email -> creates one (role employee, random password) and invites;
 * - account exists without company -> adds it to this company as employee and invites;
 * - account already a member of this company -> just links the record;
 * - account belongs to another company / is a superadmin -> nothing is created.
 */
export async function provisionEmployeeAccount(input: { companyId: string; employeeId: string; actor: { id: string; name: string } }): Promise<EmployeeAccountOutcome> {
  const [employee] = await db.select({ id: employees.id, name: employees.name, email: employees.email, userId: employees.userId, status: employees.status })
    .from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, input.companyId))).limit(1);
  if (!employee || employee.status !== "active") return "inactive";
  const invite = async (userId: string, email: string): Promise<EmployeeAccountOutcome> => {
    try {
      const sent = await createAndSendInvitation({ companyId: input.companyId, userId, email, name: employee.name, roleLabel, invitedBy: input.actor.id, inviterName: input.actor.name });
      return sent ? "invited" : "email_failed";
    } catch (error) {
      if (error instanceof InvitationError) return "cooldown";
      throw error;
    }
  };

  if (employee.userId) {
    const status = (await invitationStatuses(input.companyId, [employee.userId])).get(employee.userId);
    if (!status) return "already_active";
    const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, employee.userId)).limit(1);
    const outcome = await invite(employee.userId, account?.email ?? employee.email);
    return outcome === "invited" ? "resent" : outcome;
  }

  const email = employee.email.toLowerCase();
  const [existing] = await db.select({ id: user.id, platformRole: user.platformRole }).from(user).where(eq(user.email, email)).limit(1);
  if (existing?.platformRole === "superadmin") return "superadmin";

  let userId = existing?.id;
  if (userId) {
    const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
    if (membership && membership.companyId !== input.companyId) return "other_company";
    // A different employee record of this company is already linked to that account.
    const [taken] = await db.select({ id: employees.id }).from(employees)
      .where(and(eq(employees.companyId, input.companyId), eq(employees.userId, userId), ne(employees.id, employee.id))).limit(1);
    if (taken) return "linked_elsewhere";
    if (membership) {
      await db.update(employees).set({ userId }).where(and(eq(employees.id, employee.id), eq(employees.companyId, input.companyId)));
      return "linked";
    }
  } else {
    const created = await auth.api.signUpEmail({ body: { name: employee.name, email, password: unusablePassword() } });
    userId = created.user.id;
    // Verified again when the invitation link is used; set now so the account behaves like admin-created ones.
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
  }

  await db.insert(companyMembers).values({ companyId: input.companyId, userId, role: "employee", isActive: true, isOtpLogin: false, lastLoginAt: new Date() });
  await db.update(employees).set({ userId }).where(and(eq(employees.id, employee.id), eq(employees.companyId, input.companyId)));
  return invite(userId, email);
}

/**
 * The employee's email was edited. While the invitation is unused, the login email follows it and a
 * new invitation goes to the new address. Once the employee set a password, the login email is
 * left alone (it is how they sign in). Returns the outcome to show, or null when nothing applies.
 */
export async function syncEmployeeEmailChange(input: { companyId: string; employeeId: string; previousEmail: string; actor: { id: string; name: string } }): Promise<"email_updated" | "email_kept" | "email_taken" | EmployeeAccountOutcome | null> {
  const [employee] = await db.select({ id: employees.id, name: employees.name, email: employees.email, userId: employees.userId })
    .from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, input.companyId))).limit(1);
  if (!employee?.userId || employee.email.toLowerCase() === input.previousEmail.toLowerCase()) return null;
  const status = (await invitationStatuses(input.companyId, [employee.userId])).get(employee.userId);
  if (!status) return "email_kept";
  const email = employee.email.toLowerCase();
  const [other] = await db.select({ id: user.id }).from(user).where(and(eq(user.email, email), ne(user.id, employee.userId))).limit(1);
  if (other) return "email_taken";
  await db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, employee.userId));
  // The pending invitation pointed at the old address: drop it so a new one can be sent right away.
  await db.delete(userInvitations).where(and(eq(userInvitations.userId, employee.userId), eq(userInvitations.companyId, input.companyId), inArray(userInvitations.email, [input.previousEmail.toLowerCase()])));
  try {
    const sent = await createAndSendInvitation({ companyId: input.companyId, userId: employee.userId, email, name: employee.name, roleLabel, invitedBy: input.actor.id, inviterName: input.actor.name });
    return sent ? "email_updated" : "email_failed";
  } catch (error) {
    if (error instanceof InvitationError) return "cooldown";
    throw error;
  }
}
