import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, employees, user } from "@/db/schema";

/**
 * Why an employee email cannot be used, or null when it can. One email is one person:
 * - inside a company, one email belongs to one employee record (the login added on "User Login"
 *   already created that person's employee record, so "Tambah Karyawan" must not add a second);
 * - a login account belongs to one company, so when an account is requested for this employee the
 *   email must not be an account of another company (or a superadmin).
 */
export async function employeeEmailConflict(companyId: string, rawEmail: string, options: { excludeEmployeeId?: string; createAccount?: boolean } = {}) {
  const email = rawEmail.trim().toLowerCase();
  const [sameCompany] = await db.select({ name: employees.name }).from(employees)
    .where(and(eq(employees.companyId, companyId), sql`lower(${employees.email}) = ${email}`, options.excludeEmployeeId ? ne(employees.id, options.excludeEmployeeId) : undefined)).limit(1);
  if (sameCompany) return `Email ${email} sudah dipakai karyawan "${sameCompany.name}" di perusahaan ini. Satu email hanya untuk satu karyawan; buka data karyawan tersebut bila ingin mengubahnya.`;

  if (options.createAccount) {
    const [account] = await db.select({ platformRole: user.platformRole, companyId: companyMembers.companyId }).from(user)
      .leftJoin(companyMembers, eq(companyMembers.userId, user.id)).where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (account?.platformRole === "superadmin") return "Email ini milik akun Superadmin TepatWaktu dan tidak bisa dipakai untuk karyawan.";
    if (account?.companyId && account.companyId !== companyId) return "Email ini sudah dipakai akun login di perusahaan lain. Satu akun hanya bisa terhubung ke satu perusahaan: gunakan email lain, atau simpan tanpa akun login.";
  }
  return null;
}

/** Postgres unique violation on the employee email index (two saves racing each other). */
export function isDuplicateEmployeeEmail(error: unknown) {
  const cause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string; constraint?: string } }).cause : undefined;
  return cause?.code === "23505" && cause.constraint === "employees_company_email_unique";
}
