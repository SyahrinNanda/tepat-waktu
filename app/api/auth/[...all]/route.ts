import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);
export const GET = handler.GET;
export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/sign-up/email" || pathname === "/api/auth/send-verification-email") {
    return Response.json({ message: "Verifikasi email baru ditangani Supabase Auth." }, { status: 404 });
  }
  return handler.POST(request);
}
