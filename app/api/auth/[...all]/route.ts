import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);
export const GET = handler.GET;
export async function POST(request: Request) {
  if (new URL(request.url).pathname === "/api/auth/send-verification-email") {
    return Response.json({ message: "Gunakan endpoint pengiriman ulang email." }, { status: 404 });
  }
  return handler.POST(request);
}
