/**
 * Client IP for attendance logs and login rate limiting.
 *
 * The IP must come from a header set by a proxy we trust, never from one the client can send:
 * - Coolify/Traefik (default): `x-real-ip`, overwritten by Traefik with the address it saw.
 * - Behind Cloudflare's proxy (orange cloud): set CLIENT_IP_HEADER=cf-connecting-ip, and make sure
 *   the server only accepts traffic from Cloudflare, otherwise the header can be forged.
 * Without that header we fall back to the right-most X-Forwarded-For entry (added by the nearest
 * proxy); left-most entries are client-controlled.
 */
export function clientIp(headers: Headers): string | null {
  const configured = (process.env.CLIENT_IP_HEADER || "x-real-ip").trim().toLowerCase();
  const direct = headers.get(configured);
  const candidate = configured === "x-forwarded-for" ? lastForwarded(direct) : direct?.split(",")[0];
  return normalizeIp(candidate ?? lastForwarded(headers.get("x-forwarded-for")));
}

function lastForwarded(value: string | null | undefined) {
  const parts = value?.split(",").map((part) => part.trim()).filter(Boolean);
  return parts?.length ? parts[parts.length - 1] : undefined;
}

/** Trims, strips an IPv4-mapped IPv6 prefix and IPv6 zone; returns null for empty input. */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  ip = ip.replace(/%.*$/, "");
  if (ip.startsWith("::ffff:") && parseIpv4(ip.slice(7)) !== null) ip = ip.slice(7);
  return ip || null;
}

function parseIpv4(value: string): number | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    result = result * 256 + Number(part);
  }
  return result;
}
