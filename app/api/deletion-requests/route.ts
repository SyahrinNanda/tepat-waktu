import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { deletionRequests } from "@/db/schema";

const inputSchema = z.object({ email: z.email(), reason: z.string().max(500).optional() });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Masukkan email yang valid." }, { status: 400 });
  await db.insert(deletionRequests).values({ email: parsed.data.email.toLowerCase(), reason: parsed.data.reason || null });
  return NextResponse.json({ message: "Permintaan diterima. Kami akan melakukan verifikasi melalui email." }, { status: 201 });
}
