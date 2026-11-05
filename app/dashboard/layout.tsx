import { DashboardShell } from "@/components/dashboard-shell";
import { requireCompany } from "@/lib/current-company";
import { GlobalConfirmDialog } from "@/components/confirm-dialog";
import { activeAnnouncementsFor } from "@/features/platform-admin/server/announcements";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireCompany({ allowExpired: true });
  const announcements = await activeAnnouncementsFor(context.companyId, context.role);
  return (
    <DashboardShell userName={context.session.user.name} userEmail={context.session.user.email} companyName={context.companyName} role={context.role} isSuperAdmin={context.isSuperAdmin} subscription={{ ...context.subscription, timezone: context.timezone }} announcements={announcements}>
      {children}
      <GlobalConfirmDialog />
    </DashboardShell>
  );
}
