import { DashboardShell } from "@/components/dashboard-shell";
import { requireCompany } from "@/lib/current-company";
import { GlobalConfirmDialog } from "@/components/confirm-dialog";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireCompany();
  return (
    <DashboardShell userName={context.session.user.name} userEmail={context.session.user.email} companyName={context.companyName} role={context.role} isSuperAdmin={context.isSuperAdmin}>
      {children}
      <GlobalConfirmDialog />
    </DashboardShell>
  );
}
