// Next.js configuration
import type { NextConfig } from "next";

// Outside origins the browser talks to: Midtrans Snap (payment popup) and OpenStreetMap tiles (location map).
// Geocoding, e-mail and storage calls run on the server, so they need no entry here.
const MIDTRANS = "https://app.midtrans.com https://app.sandbox.midtrans.com https://api.midtrans.com https://api.sandbox.midtrans.com https://*.midtrans.com";
const MAP_TILES = "https://tile.openstreetmap.org";

// `next dev` needs eval (fast refresh) and a websocket; production gets neither.
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy: the browser only runs, loads and frames what is listed here.
 * - 'unsafe-inline' scripts: Next.js inlines its bootstrap scripts (no nonce setup).
 * - No 'unsafe-eval' in production: nothing in the client bundle needs eval. Keep zod (which probes
 *   eval) out of client components; see features/leave-requests/leave-types.ts.
 * - No upgrade-insecure-requests: it would also rewrite http://localhost; HSTS keeps production on https.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${MIDTRANS}`,
  `style-src 'self' 'unsafe-inline' ${MIDTRANS}`,
  `img-src 'self' data: blob: ${MAP_TILES} ${MIDTRANS}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""} ${MIDTRANS}`,
  `frame-src 'self' ${MIDTRANS}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
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
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
