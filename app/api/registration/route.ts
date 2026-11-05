import { NextResponse } from "next/server";
import { handleRegistration } from "@/lib/registration/register";

// Public sign-up: creates the (unverified) account and sends the verification email.
export async function POST(request: Request) {
  const result = await handleRegistration(await request.json().catch(() => null), request.headers);
  return NextResponse.json(result.body, { status: result.status });
}
