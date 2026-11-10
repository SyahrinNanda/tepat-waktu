"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Send } from "lucide-react";
import { sendEmployeeInviteAction } from "@/features/workforce/server/actions";
import { employeeAccountMessage } from "@/features/invitations/account-messages";
import type { EmployeeAccountStatus } from "@/features/invitations/server/employee-account";

const copy: Record<EmployeeAccountStatus, { label: string; text: string }> = {
  active: { label: "Aktif", text: "Karyawan sudah bisa masuk ke aplikasi untuk mencatat kehadiran, kunjungan, dan pengajuan." },
  pending: { label: "Menunggu undangan", text: "Email undangan sudah dikirim, tetapi karyawan belum membuat password." },
  expired: { label: "Undangan kedaluwarsa", text: "Tautan undangan sudah lewat 7 hari. Kirim ulang agar karyawan bisa membuat password." },
  none: { label: "Belum punya akun", text: "Karyawan belum bisa masuk ke aplikasi. Buat akun dan kirim undangan ke email karyawan." },
};

export function EmployeeAccountCard({ employeeId, status, loginEmail, employeeEmail, canManage, initialNotice }: {
  employeeId: string; status: EmployeeAccountStatus; loginEmail: string | null; employeeEmail: string; canManage: boolean;
  initialNotice: { tone: "success" | "warning" | "error"; text: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState(initialNotice);
  const info = copy[status];
  const email = loginEmail ?? employeeEmail;

  const send = () => start(async () => {
    const { outcome } = await sendEmployeeInviteAction(employeeId);
    setNotice(employeeAccountMessage(outcome, email));
    router.refresh();
  });

  return <>
    {notice && <div className={`employee-account-notice ${notice.tone}`} role="status">{notice.text}</div>}
    <section className="employee-account-card" aria-label="Akun login karyawan">
      <div>
        <h3><KeyRound size={16} /> Akun login <span className={`account-pill ${status}`}>{info.label}</span></h3>
        <p>{info.text}{loginEmail && loginEmail !== employeeEmail ? ` Email login: ${loginEmail}.` : ""}</p>
      </div>
      {canManage && (status === "none" || status === "pending" || status === "expired") && (
        <button className="btn btn-primary btn-sm" type="button" onClick={send} disabled={pending}>
          <Send size={14} /> {pending ? "Mengirim..." : status === "none" ? "Buat akun & kirim undangan" : "Kirim ulang undangan"}
        </button>
      )}
      {canManage && status === "active" && <Link className="btn btn-outline btn-sm" href="/dashboard/pengaturan/users">Atur level & password</Link>}
    </section>
  </>;
}
