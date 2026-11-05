/**
 * Client IP and IP-whitelist matching.
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

export function parseIpv4(value: string): number | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = result * 256 + octet;
  }
  return result;
}

const isIpv6 = (value: string) => value.includes(":") && /^[0-9a-f:.]+$/i.test(value) && value.split("::").length <= 2;

export type WhitelistEntry = { type: "satuan_wildcard"; ip: string } | { type: "rentang"; rangeFrom: string; rangeTo: string };

/** Pattern like 192.168.1.10, 192.168.1.* / 192.168.1.x, or an exact IPv6 address. */
function wildcardPattern(pattern: string) {
  const value = pattern.trim().toLowerCase();
  if (isIpv6(value)) return { ipv6: normalizeIp(value) };
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => part === "*" || part === "x" ? "*" : /^\d{1,3}$/.test(part) && Number(part) <= 255 ? String(Number(part)) : null);
  if (octets.includes(null)) return null;
  // Wildcards only at the end (192.168.*.* is fine, 192.*.1.1 is not).
  const firstWildcard = octets.indexOf("*");
  if (firstWildcard !== -1 && octets.slice(firstWildcard).some((octet) => octet !== "*")) return null;
  if (firstWildcard === 0) return null; // "*.*.*.*" would allow everyone.
  return { octets: octets as string[] };
}

/** Error message for an invalid entry, or null when it is valid. */
export function whitelistEntryError(entry: WhitelistEntry): string | null {
  if (entry.type === "satuan_wildcard") {
    return wildcardPattern(entry.ip) ? null : `"${entry.ip}" bukan IP yang valid. Contoh: 103.20.10.5, 192.168.1.* atau 192.168.1.x.`;
  }
  const from = parseIpv4(entry.rangeFrom), to = parseIpv4(entry.rangeTo);
  if (from === null || to === null) return "Rentang IP harus berupa dua alamat IPv4, contoh 192.168.1.10 sampai 192.168.1.50.";
  if (from > to) return "IP awal harus lebih kecil atau sama dengan IP akhir.";
  return null;
}

export function ipMatchesEntry(ip: string, entry: WhitelistEntry): boolean {
  const address = normalizeIp(ip);
  if (!address) return false;
  if (entry.type === "rentang") {
    const value = parseIpv4(address), from = parseIpv4(entry.rangeFrom), to = parseIpv4(entry.rangeTo);
    return value !== null && from !== null && to !== null && value >= from && value <= to;
  }
  const pattern = wildcardPattern(entry.ip);
  if (!pattern) return false;
  if ("ipv6" in pattern) return pattern.ipv6 === address;
  const octets = address.split(".");
  return parseIpv4(address) !== null && pattern.octets.every((octet, index) => octet === "*" || octet === String(Number(octets[index])));
}
