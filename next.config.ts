// Next.js configuration
import type { NextConfig } from "next";

// Outside origins the browser talks to: Midtrans Snap (payment popup) and OpenStreetMap tiles (location map).
// Geocoding, e-mail and storage calls run on the server, so they need no entry here.
const MIDTRANS = "https://app.midtrans.com https://app.sandbox.midtrans.com https://api.midtrans.com https://api.sandbox.midtrans.com https://*.midtrans.com";
const MAP_TILES = "https://tile.openstreetmap.org";

/**
 * Enforced policy: only rules that cannot break a page (no iframing by other sites, no plugins,
 * no <base> hijack, forms only to us/Midtrans). No upgrade-insecure-requests: it would also rewrite
 * http://localhost in development; HSTS already keeps production on https.
 */
const enforcedCsp = [
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${MIDTRANS}`,
].join("; ");

/**
 * Full allow-list, report-only for now: the browser console lists anything it would block, so the
 * list can be checked on production (payment, map, camera) before it is enforced.
 */
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${MIDTRANS}`,
  `style-src 'self' 'unsafe-inline' ${MIDTRANS}`,
  `img-src 'self' data: blob: ${MAP_TILES} ${MIDTRANS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${MIDTRANS}`,
  `frame-src 'self' ${MIDTRANS}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${MIDTRANS}`,
].join("; ");

const securityHeaders = [
  // HTTPS only for a year. No includeSubDomains: mail/ftp/e-mail tracking subdomains are not ours to force.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera (attendance/visit selfies) and location (check-in, office map) stay allowed for this site only.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(self), usb=(), browsing-topics=()" },
  // Midtrans may open a popup (e-wallet, 3-D Secure); "allow-popups" keeps that working.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  devIndicators: false,
  serverExternalPackages: ["exceljs"],
  // Do not advertise the framework ("X-Powered-By: Next.js").
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
