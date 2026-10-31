import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import type { FeatureModule } from "@/features/generic-modules/config/feature-modules";
import { featureContext } from "@/features/generic-modules/server/feature-records";

export const reviewerRoles = ["admin", "owner", "general_manager", "hrd"];
export type RequestContext = Exclude<Awaited<ReturnType<typeof featureContext>>, { error: Response }>;

export async function employeeRequestContext(request: Request, module: FeatureModule, operation: "read" | "write" | "manage") {
  return featureContext(request, module, operation);
}

export async function selectableEmployee(context: RequestContext, employeeId: string) {
  const [employee] = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, userId: employees.userId }).from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, context.companyId), eq(employees.status, "active"))).limit(1);
  if (!employee || (!reviewerRoles.includes(context.role) && employee.userId !== context.userId)) return null;
  return employee;
}

export function canReviewRequests(role: string) { return reviewerRoles.includes(role); }

export function revalidateRequestPaths(revalidatePath: (path: string) => void, path: string, id?: string) {
  revalidatePath("/dashboard/pengajuan"); revalidatePath(path); revalidatePath("/dashboard"); if (id) revalidatePath(`${path}/${id}`);
}
