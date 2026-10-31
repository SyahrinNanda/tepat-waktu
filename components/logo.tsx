import Link from "next/link";
import type { Route } from "next";

export function Logo({ href = "/" }: { href?: Route }) {
  return (
    <Link href={href} className="brand" aria-label="TepatWaktu">
      <svg className="brand-mark" viewBox="0 0 72 64" aria-hidden="true">
        <path className="brand-mark-thumb" d="M35.5 53.5h15V30.2c-6.7-3.7-9.6-9.2-8.9-17.3.5-6.2 7-6.5 7.6-.4.6 6.5-.5 10.8 5.6 17.4l9.2 1.3v24.2H50.5" />
        <circle className="brand-mark-face" cx="27" cy="39" r="18.5" />
        <path className="brand-mark-top" d="M21.5 17.7h11M24 17.7v4.1m6-4.1v4.1" />
        <path className="brand-mark-tick" d="M27 29.2V39h8.6" />
        <path className="brand-mark-fingers" d="M7 24.5h13.2a5 5 0 0 1 0 10H7a5 5 0 0 1 0-10Zm-1.2 10h11.9a5 5 0 0 1 0 10H5.8a5 5 0 0 1 0-10Zm2.2 10h11a5 5 0 0 1 0 10H8a5 5 0 0 1 0-10Z" />
        <path className="brand-mark-accent" d="M40 5.5V1.8m8.1 5.8 2.2-3M32 7.6l-2.2-3" />
      </svg>
      <span className="brand-wordmark">Tepat<span>Waktu</span></span>
    </Link>
  );
}
