"use server";

import { redirect } from "next/navigation";
import { confirmAccountDeletion } from "@/features/account-requests/server/deletion";

export async function confirmDeletionAction(form: FormData) {
  const ok = await confirmAccountDeletion(String(form.get("token") ?? ""));
  redirect(`/penghapusan-akun/konfirmasi?status=${ok ? "confirmed" : "invalid"}`);
}
