"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Rendered once an invoice has just been activated. A client-side refresh keeps the dashboard layout
 * (expired-plan banner, locked menu) from before the activation, so ask the server for it again once.
 */
export function RefreshLayoutOnce() {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    router.refresh();
  }, [router]);
  return null;
}
