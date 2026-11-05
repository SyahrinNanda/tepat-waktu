import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { findConfirmableRequest } from "@/features/account-requests/server/deletion";
import { confirmDeletionAction } from "./actions";

export const metadata: Metadata = { title: "Konfirmasi Penghapusan Akun" };

/**
 * Opened from the emailed link. Confirming needs a click (POST), so email scanners that prefetch
 * links cannot queue a deletion by themselves.
 */
export default async function ConfirmDeletionPage({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token = "", status } = await searchParams;
  const request = status ? null : await findConfirmableRequest(token);
  const state = status === "confirmed" ? "confirmed" : request ? "ready" : "invalid";

  return (
    <AuthShell variant="login">
      <div className="auth-main login-auth-main account-deletion-main">
        <Link href="/" className="account-deletion-back"><ArrowLeft size={16} /> Kembali ke login</Link>
        <span className="login-form-kicker">PENGELOLAAN AKUN</span>
        {state === "ready" && <>
          <h1>Konfirmasi penghapusan akun</h1>
          <p className="login-form-lead">Anda akan mengajukan penghapusan akun <strong>{request!.email}</strong>. Setelah dikonfirmasi, permintaan ditinjau administrator. Jika disetujui, akun beserta sesi login dan keanggotaan perusahaannya dihapus permanen, dan Anda akan menerima email pemberitahuan.</p>
          <form action={confirmDeletionAction}>
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-primary btn-block" type="submit">Ya, konfirmasi penghapusan akun</button>
          </form>
          <p className="auth-foot">Berubah pikiran? Cukup tutup halaman ini; akun Anda tidak berubah.</p>
        </>}
        {state === "confirmed" && <>
          <div className="success-box" role="status"><MailCheck size={16} /> Permintaan dikonfirmasi.</div>
          <h1>Permintaan sedang ditinjau</h1>
          <p className="login-form-lead">Terima kasih. Permintaan penghapusan akun Anda sudah diteruskan ke administrator. Kami akan mengirim email setelah permintaan diproses. Sampai saat itu akun Anda masih aktif.</p>
        </>}
        {state === "invalid" && <>
          <div className="error-box" role="alert"><CircleAlert size={16} /> Tautan tidak berlaku.</div>
          <h1>Tautan sudah kedaluwarsa atau sudah dipakai</h1>
          <p className="login-form-lead">Tautan konfirmasi hanya berlaku 24 jam dan hanya bisa dipakai sekali. Jika Anda masih ingin menghapus akun, ajukan permintaan baru.</p>
          <Link className="btn btn-primary btn-block" href="/penghapusan-akun">Ajukan permintaan baru</Link>
        </>}
      </div>
    </AuthShell>
  );
}
