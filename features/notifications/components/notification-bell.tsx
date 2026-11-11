"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, CalendarClock, CheckCircle2, ClipboardList, Megaphone, MessageSquareWarning } from "lucide-react";
import { hasSubscriptionAlert, subscriptionAlertCopy, type SubscriptionAlertInput } from "@/features/subscriptions/components/subscription-alerts";
import { loadNotificationsAction, markNotificationsSeenAction } from "@/features/notifications/server/actions";
import type { NotificationItem, NotificationKind } from "@/features/notifications/server/notifications";

const POLL_MS = 60_000;
const icons: Record<NotificationKind, typeof Bell> = {
  announcement: Megaphone, complaint: MessageSquareWarning, leave: ClipboardList, overtime: CalendarClock, leave_result: CheckCircle2, overtime_result: CheckCircle2,
};

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

/**
 * Topbar bell: the subscription warning (when any) plus announcements, complaints and leave/overtime
 * requests for this user. Refreshed on every page change, every minute and when the tab regains focus.
 */
export function NotificationBell({ subscription, canRenew }: { subscription?: SubscriptionAlertInput; canRenew: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const feed = await loadNotificationsAction();
      setItems(feed.items);
      setUnread(feed.unread);
      return feed;
    } catch { return null; }
  }, []);

  // Fetching from the server on every page change (the state is set after the response arrives).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh, pathname]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    const feed = await refresh();
    const count = feed?.unread ?? unread;
    if (count > 0) {
      // Keep the new items highlighted while the panel is open, then mark them read.
      setFreshIds((feed?.items ?? items).slice(0, count).map((item) => item.id));
      setUnread(0);
      void markNotificationsSeenAction().catch(() => undefined);
    } else setFreshIds([]);
  }

  const alert = subscription && hasSubscriptionAlert(subscription) ? subscriptionAlertCopy(subscription, canRenew) : null;
  const badge = unread + (alert ? 1 : 0);
  return <div className="notification-wrap" ref={ref}>
    <button className="icon-button notification-button" type="button" aria-label={badge ? `Notifikasi (${badge} baru)` : "Notifikasi"} aria-expanded={open} onClick={toggle}>
      <Bell size={19} />
      {badge ? <b className="notification-count">{badge > 9 ? "9+" : badge}</b> : null}
    </button>
    {open ? <div className="notification-panel" role="dialog" aria-label="Notifikasi">
      <strong className="notification-panel-title">Notifikasi</strong>
      <div className="notification-list">
        {alert ? <div className={`notification-item ${alert.tone}`}><AlarmClock size={16} /><span><b>{alert.title}</b><small>{alert.body}</small>{canRenew ? <Link href="/dashboard/langganan" onClick={() => setOpen(false)}>Buka Langganan</Link> : null}</span></div> : null}
        {items.map((item) => {
          const Icon = icons[item.kind];
          return <Link key={item.id} href={item.href as Route} className={`notification-item notification-link${freshIds.includes(item.id) ? " fresh" : ""}`} onClick={() => setOpen(false)}>
            <Icon size={16} />
            <span><b>{item.title}</b><small>{item.body}</small><em>{ago(item.at)}</em></span>
          </Link>;
        })}
        {!alert && !items.length ? <p className="notification-empty">Belum ada notifikasi.</p> : null}
      </div>
    </div> : null}
  </div>;
}
