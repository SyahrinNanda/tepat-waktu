import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RequestForm } from "@/features/account-requests/components/request-form";

export const metadata: Metadata = { title: "Hapus data karyawan" };

export default function DeleteEmployeePage() {
  return (
    <AuthShell><div className="auth-main">
      <Link href="/" className="text-link" style={{ display: "inline-flex", gap: 7, alignItems: "center", marginBottom: 24 }}><ArrowLeft size={15} /> Kembali</Link>
      <h1>Hapus data karyawan</h1>
      <p className="lead">Ajukan penghapusan data pribadi. Tim administrator akan memverifikasi kepemilikan email sebelum memprosesnya.</p>
      <RequestForm type="deletion" />
    </div></AuthShell>
  );
}
