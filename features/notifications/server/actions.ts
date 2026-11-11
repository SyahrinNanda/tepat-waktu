"use server";

import { requireCompany } from "@/lib/current-company";
import { markNotificationsSeen, notificationFeed, type NotificationFeed } from "./notifications";

/** The signed-in user's notification feed (polled by the topbar bell). */
export async function loadNotificationsAction(): Promise<NotificationFeed> {
  const context = await requireCompany({ allowExpired: true });
  return notificationFeed({ companyId: context.companyId, userId: context.session.user.id, role: context.role, isSuperAdmin: context.isSuperAdmin });
}

/** Opening the bell marks everything currently listed as read. */
export async function markNotificationsSeenAction() {
  const context = await requireCompany({ allowExpired: true });
  await markNotificationsSeen(context.session.user.id);
}
