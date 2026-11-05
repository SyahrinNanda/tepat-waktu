import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);
export const GET = handler.GET;
export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  // Public sign-up must go through /api/registration, which also stores the company data.
  if (pathname === "/api/auth/sign-up/email") {
    return Response.json({ message: "Gunakan formulir pendaftaran di /register." }, { status: 404 });
  }
  return handler.POST(request);
}
