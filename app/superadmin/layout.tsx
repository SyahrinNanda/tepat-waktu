import { SuperAdminShell } from "@/components/superadmin-shell";
import { requireSuperAdmin } from "@/lib/superadmin";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();
  return <SuperAdminShell userName={session.user.name} userEmail={session.user.email}>{children}</SuperAdminShell>;
}
