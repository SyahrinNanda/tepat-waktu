"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Info, Megaphone, Sparkles, Wrench, X } from "lucide-react";
import type { TenantAnnouncement } from "../server/announcements";

const icons = { info: Info, feature: Sparkles, maintenance: Wrench, warning: Megaphone } as const;
const toneLabel = { info: "Info", feature: "Fitur baru", maintenance: "Maintenance", warning: "Penting" } as const;
const storageKey = (item: TenantAnnouncement) => `tepatwaktu:announcement:${item.id}:${item.version}`;

/** Platform-wide notices from the superadmin, shown above every dashboard page until dismissed. */
export function PlatformAnnouncements({ items }: { items: TenantAnnouncement[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const dismissed = new Set<string>();
    for (const item of items) {
      try { if (window.localStorage.getItem(storageKey(item)) === "1") dismissed.add(item.id); } catch { /* storage unavailable: show everything */ }
    }
    // Read after mount so server and client render the same markup first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(dismissed);
    setReady(true);
  }, [items]);
  const visible = items.filter((item) => !hidden.has(item.id));
  if (!ready || !visible.length) return null;
  return <div className="platform-announcements">{visible.map((item) => {
    const Icon = icons[item.tone];
    return <div key={item.id} className={`platform-announcement ${item.tone}`} role={item.tone === "warning" || item.tone === "maintenance" ? "alert" : "status"}>
      <Icon size={18} />
      <span><b>{toneLabel[item.tone]} · {item.title}</b> {item.message}{item.linkUrl ? <> {item.linkUrl.startsWith("/") ? <Link href={item.linkUrl as Route}>{item.linkLabel ?? "Selengkapnya"}</Link> : <a href={item.linkUrl} target="_blank" rel="noreferrer">{item.linkLabel ?? "Selengkapnya"}</a>}</> : null}</span>
      <button type="button" className="icon-button" aria-label="Tutup pengumuman" onClick={() => {
        try { window.localStorage.setItem(storageKey(item), "1"); } catch { /* ignore */ }
        setHidden((current) => new Set(current).add(item.id));
      }}><X size={15} /></button>
    </div>;
  })}</div>;
}
