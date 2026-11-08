import Link from "next/link";
import type { Route } from "next";

/**
 * TepatWaktu logotype (text only, no icon): "Tepat" black + "Waktu" white on the brand yellow.
 * On yellow surfaces (sidebar, login story panel) the text sits directly on the yellow; elsewhere
 * it gets its own yellow box (see .brand-logotype in app/refresh.css).
 */
export function Logotype({ href = "/" }: { href?: Route }) {
  return (
    <Link href={href} className="brand-logotype" aria-label="TepatWaktu">
      Tepat<span>Waktu</span>
    </Link>
  );
}

/** Same logotype without a link, e.g. inside a card. */
export function LogotypeMark() {
  return <span className="brand-logotype" aria-label="TepatWaktu">Tepat<span>Waktu</span></span>;
}

/** Kept for existing call sites (dashboard and superadmin sidebars). */
export function Logo({ href = "/" }: { href?: Route }) {
  return <Logotype href={href} />;
}
