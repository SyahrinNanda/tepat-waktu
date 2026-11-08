"use server";

import { acceptInvitation, InvitationError } from "@/features/invitations/server/invitations";

export type AcceptInvitationState = { status: "idle" | "error" | "done"; message?: string; email?: string };

export async function acceptInvitationAction(_previous: AcceptInvitationState, form: FormData): Promise<AcceptInvitationState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 128) return { status: "error", message: "Password harus 8–128 karakter." };
  if (password !== confirmation) return { status: "error", message: "Konfirmasi password tidak sama." };
  try {
    const result = await acceptInvitation(token, password);
    return { status: "done", email: result.email };
  } catch (error) {
    if (error instanceof InvitationError) return { status: "error", message: error.message };
    console.error("Undangan gagal diterima:", error);
    return { status: "error", message: "Password belum dapat disimpan. Coba lagi beberapa saat lagi." };
  }
}
