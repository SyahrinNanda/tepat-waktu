"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import type { PopupAnnouncement } from "@/features/announcements/server/popup";

// "Jangan tampilkan lagi": hidden for good on this browser (until the admin edits the text).
const hiddenKey = (item: PopupAnnouncement) => `tepatwaktu:company-announcement:${item.id}:${item.version}`;
// "Tutup": hidden until the next login (a new login has a new loginKey).
const closedKey = (loginKey: string) => `tepatwaktu:company-announcement-closed:${loginKey}`;

function read(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } }

/** After login, shows the newest company announcement the member has not hidden. */
export function AnnouncementPopup({ items, loginKey }: { items: PopupAnnouncement[]; loginKey: string }) {
  const [item, setItem] = useState<PopupAnnouncement | null>(null);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (read(closedKey(loginKey))) return;
    const next = items.find((candidate) => read(hiddenKey(candidate)) !== "1") ?? null;
    // Read storage after mount so the server and client render the same markup first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItem(next);
  }, [items, loginKey]);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    if (!item) return;
    if (dontShow) write(hiddenKey(item), "1");
    write(closedKey(loginKey), "1");
    setItem(null);
  }

  if (!item) return null;
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(item.createdAt));
  return <div className="announcement-popup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="announcement-popup" role="dialog" aria-modal="true" aria-labelledby="announcement-popup-title">
      <header>
        <span className="announcement-popup-kicker"><Megaphone size={15} />Pemberitahuan</span>
        <button type="button" aria-label="Tutup" onClick={close}><X size={18} /></button>
      </header>
      {item.imageAssetId ? <Image className="announcement-popup-image" src={`/api/files/${item.imageAssetId}`} alt="" width={640} height={300} unoptimized /> : null}
      <div className="announcement-popup-body">
        <h2 id="announcement-popup-title">{item.title}</h2>
        <small>{date}</small>
        <p>{item.content}</p>
      </div>
      <footer>
        <label className="announcement-popup-check"><input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} />Jangan tampilkan lagi</label>
        <div>
          <Link href="/dashboard/pengumuman" className="btn btn-outline" onClick={close}>Lihat semua</Link>
          <button type="button" className="btn btn-primary" onClick={close} autoFocus>Tutup</button>
        </div>
      </footer>
    </section>
  </div>;
}
