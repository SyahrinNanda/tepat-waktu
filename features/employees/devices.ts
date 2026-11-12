export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";
export type ParsedDevice = { kind: DeviceKind; name: string; browser: string };

/** Readable device from a browser user agent: "Android 14 · Pixel 8", "iPhone · iOS 18.5", "Windows 10/11"... */
export function parseUserAgent(userAgent: string | null | undefined): ParsedDevice {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return { kind: "unknown", name: "Perangkat tidak dikenal", browser: "–" };
  const browser = /Edg(?:A|iOS)?\//.test(ua) ? "Microsoft Edge"
    : /SamsungBrowser\//.test(ua) ? "Samsung Internet"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /CriOS\/|Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /^curl\//i.test(ua) ? "curl" : "Lainnya";
  const version = (pattern: RegExp) => ua.match(pattern)?.[1]?.replace(/_/g, ".");

  const android = version(/Android (\d+(?:\.\d+)?)/);
  if (android !== undefined || /Android/.test(ua)) {
    const model = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\)/)?.[1]?.trim();
    const tablet = !/Mobile/.test(ua);
    return { kind: tablet ? "tablet" : "mobile", name: [`Android${android ? ` ${android}` : ""}`, model && model !== "K" ? model : null].filter(Boolean).join(" · "), browser };
  }
  if (/iPhone/.test(ua)) return { kind: "mobile", name: `iPhone · iOS ${version(/OS (\d+[_.]\d+)/) ?? ""}`.trim(), browser };
  if (/iPad/.test(ua)) return { kind: "tablet", name: `iPad · iPadOS ${version(/OS (\d+[_.]\d+)/) ?? ""}`.trim(), browser };
  if (/Windows NT 10/.test(ua)) return { kind: "desktop", name: "Windows 10/11", browser };
  if (/Windows/.test(ua)) return { kind: "desktop", name: "Windows", browser };
  if (/Mac OS X/.test(ua)) return { kind: "desktop", name: "macOS", browser };
  if (/CrOS/.test(ua)) return { kind: "desktop", name: "ChromeOS", browser };
  if (/Linux/.test(ua)) return { kind: "desktop", name: "Linux", browser };
  return { kind: "unknown", name: "Perangkat lain", browser };
}
