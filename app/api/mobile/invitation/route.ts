import { z } from "zod";
import { acceptInvitation, findUsableInvitation, InvitationError } from "@/features/invitations/server/invitations";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const invitation = await findUsableInvitation(token);
  return invitation ? Response.json({ invitation: { companyName: invitation.companyName, name: invitation.name, email: invitation.email } }) : Response.json({ error: "Tautan undangan tidak berlaku." }, { status: 404 });
}
export async function POST(request: Request) {
  const parsed = z.object({ token: z.string().min(1), password: z.string().min(8).max(128), confirmation: z.string() }).refine((value) => value.password === value.confirmation, { message: "Konfirmasi kata sandi tidak sama." }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Data undangan tidak valid." }, { status: 400 });
  try {
    const result = await acceptInvitation(parsed.data.token, parsed.data.password);
    return Response.json({ email: result.email });
  } catch (error) {
    if (error instanceof InvitationError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Mobile invitation failed", error);
    return Response.json({ error: "Undangan belum dapat diproses." }, { status: 500 });
  }
}
