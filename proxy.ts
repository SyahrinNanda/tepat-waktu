import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  let parsed: URL | null = null;
  try { if (origin) parsed = new URL(origin); } catch {}
  const host = request.nextUrl.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || /^192\.168\.\d+\.\d+$/.test(host);
  const allowed = parsed && process.env.NODE_ENV === "development" && local && parsed.protocol === "http:" &&
    (parsed.hostname === host || (["localhost", "127.0.0.1"].includes(parsed.hostname) && ["localhost", "127.0.0.1"].includes(host)));
  if (!allowed || !origin) return NextResponse.next();
  const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", request.headers.get("access-control-request-headers") || "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export const config = { matcher: "/api/:path*" };
