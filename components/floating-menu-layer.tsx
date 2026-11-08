"use client";

import { useEffect } from "react";

const GAP = 4;
const EDGE = 8;

/**
 * Row menus inside scrollable tables (overflow-x: auto also clips vertically) were cut off and
 * produced an inner scrollbar. Any element marked `data-float-menu` is pinned to the viewport
 * (position: fixed) next to its trigger: its parent element is the anchor. The menu is
 * right-aligned to the anchor, opens upward when there is no room below, and follows scrolling.
 * Mounted once in the dashboard and superadmin shells.
 */
export function FloatingMenuLayer() {
  useEffect(() => {
    let frame = 0;
    const place = () => {
      frame = 0;
      for (const menu of document.querySelectorAll<HTMLElement>("[data-float-menu]")) {
        const anchor = menu.parentElement;
        // Hidden (e.g. closed <details>): nothing to place.
        if (!anchor || menu.offsetParent === null && getComputedStyle(menu).position !== "fixed") continue;
        if (menu.closest("details") && !menu.closest("details")!.open) continue;
        const box = (anchor.querySelector("summary, button") ?? anchor).getBoundingClientRect();
        const width = menu.offsetWidth, height = menu.offsetHeight;
        const below = window.innerHeight - box.bottom - GAP - EDGE;
        const top = below >= height || box.top < height + GAP ? box.bottom + GAP : box.top - height - GAP;
        const left = Math.min(Math.max(box.right - width, EDGE), window.innerWidth - width - EDGE);
        Object.assign(menu.style, { position: "fixed", top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, right: "auto", bottom: "auto", margin: "0", zIndex: "1200" });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
