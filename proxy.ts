import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = origin && process.env.NODE_ENV === "development" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (!allowed) return NextResponse.next();
  const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", request.headers.get("access-control-request-headers") || "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export const config = { matcher: "/api/:path*" };
