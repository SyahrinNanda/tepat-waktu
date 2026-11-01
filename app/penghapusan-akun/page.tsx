import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RequestForm } from "@/features/account-requests/components/request-form";

export const metadata: Metadata = { title: "Penghapusan Akun" };

export default function AccountDeletionPage() {
  return (
    <AuthShell variant="login">
      <div className="auth-main login-auth-main account-deletion-main">
        <Link href="/" className="account-deletion-back"><ArrowLeft size={16} /> Kembali ke login</Link>
        <span className="login-form-kicker">PENGELOLAAN AKUN</span>
        <h1>Penghapusan akun</h1>
        <p className="login-form-lead">Masukkan email akun yang ingin dihapus. Permintaan Anda akan dicatat untuk ditinjau administrator. Akun tidak langsung dihapus setelah formulir dikirim.</p>
        <RequestForm type="deletion" />
      </div>
    </AuthShell>
  );
}
