import Link from "next/link";
import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { findUsableInvitation } from "@/features/invitations/server/invitations";
import { AcceptInvitationForm } from "@/features/invitations/components/accept-invitation-form";

export const metadata: Metadata = { title: "Undangan TepatWaktu" };

/**
 * Opened from the invitation email. The link only shows the form; the password is set on submit
 * (POST), so email scanners that prefetch links cannot use the invitation.
 */
export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const invitation = await findUsableInvitation(token);

  return (
    <AuthShell variant="login">
      <div className="auth-main login-auth-main">
        <span className="login-form-kicker">UNDANGAN</span>
        {invitation ? <>
          <h1>Bergabung ke {invitation.companyName}</h1>
          <p className="login-form-lead">Halo {invitation.name}, buat password untuk akun <strong>{invitation.email}</strong>. Setelah itu Anda bisa langsung masuk ke TepatWaktu.</p>
          <AcceptInvitationForm token={token} email={invitation.email} />
        </> : <>
          <div className="error-box" role="alert"><CircleAlert size={16} /> Tautan undangan tidak berlaku.</div>
          <h1>Tautan sudah dipakai atau kedaluwarsa</h1>
          <p className="login-form-lead">Tautan undangan berlaku 7 hari dan hanya bisa dipakai sekali. Jika Anda sudah membuat password, silakan masuk. Jika belum, minta admin perusahaan Anda mengirim ulang undangan.</p>
          <Link className="btn btn-primary btn-block" href="/">Ke halaman login</Link>
          <p className="auth-foot">Lupa password? <Link className="text-link" href="/lupa-password">Atur ulang di sini</Link></p>
        </>}
      </div>
    </AuthShell>
  );
}
