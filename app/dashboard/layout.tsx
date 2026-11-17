import { DashboardShell } from "@/components/dashboard-shell";
import { requireCompany } from "@/lib/current-company";
import { GlobalConfirmDialog } from "@/components/confirm-dialog";
import { activeAnnouncementsFor } from "@/features/platform-admin/server/announcements";
import { AnnouncementPopup } from "@/features/announcements/components/announcement-popup";
import { popupAnnouncements } from "@/features/announcements/server/popup";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireCompany({ allowExpired: true });
  // Company announcements pop up after login for members; the admin writes them, so skip the admin.
  const showPopup = !context.isSuperAdmin && context.role !== "admin" && context.role !== "owner";
  const [announcements, popupItems] = await Promise.all([
    activeAnnouncementsFor(context.companyId, context.role),
    showPopup ? popupAnnouncements(context.companyId) : Promise.resolve([]),
  ]);
  const loginKey = `${context.session.user.id}:${new Date(context.session.session.createdAt).getTime()}`;
  return (
    <DashboardShell userName={context.session.user.name} userEmail={context.session.user.email} companyName={context.companyName} role={context.role} isSuperAdmin={context.isSuperAdmin} subscription={{ ...context.subscription, timezone: context.timezone }} announcements={announcements}>
      {children}
      <GlobalConfirmDialog />
      {popupItems.length ? <AnnouncementPopup items={popupItems} loginKey={loginKey} /> : null}
    </DashboardShell>
  );
}
