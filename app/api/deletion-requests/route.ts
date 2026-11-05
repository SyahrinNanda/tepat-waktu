import { NextResponse } from "next/server";
import { z } from "zod";
import { DELETION_REQUEST_MESSAGE, requestAccountDeletion } from "@/features/account-requests/server/deletion";

const inputSchema = z.object({ email: z.email(), reason: z.string().max(500).optional() });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Masukkan email yang valid." }, { status: 400 });
  await requestAccountDeletion(parsed.data.email, parsed.data.reason?.trim() || null);
  return NextResponse.json({ message: DELETION_REQUEST_MESSAGE }, { status: 202 });
}
