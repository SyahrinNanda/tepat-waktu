"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { acceptInvitationAction, type AcceptInvitationState } from "@/app/undangan/actions";

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AcceptInvitationState, FormData>(acceptInvitationAction, { status: "idle" });
  const [show, setShow] = useState(false);

  if (state.status === "done") {
    return <>
      <div className="success-box" role="status">Password berhasil dibuat.</div>
      <p className="login-form-lead">Akun Anda siap. Masuk dengan email <strong>{state.email}</strong> dan password yang baru saja Anda buat.</p>
      <Link className="btn btn-primary btn-block" href="/">Masuk sekarang</Link>
    </>;
  }

  return <>
    {state.status === "error" && <div className="error-box" role="alert">{state.message}</div>}
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new password under the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="field">
        <label htmlFor="invite-password">Password baru</label>
        <div style={{ position: "relative" }}>
          <input id="invite-password" name="password" className="input" type={show ? "text" : "password"} minLength={8} maxLength={128} autoComplete="new-password" required style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "var(--muted)", cursor: "pointer", padding: 4 }}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="invite-confirmation">Ulangi password</label>
        <input id="invite-confirmation" name="confirmation" className="input" type={show ? "text" : "password"} minLength={8} maxLength={128} autoComplete="new-password" required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Menyimpan..." : "Buat password & aktifkan akun"}</button>
    </form>
    <p className="auth-foot">Minimal 8 karakter. Password hanya Anda yang tahu; admin perusahaan tidak bisa melihatnya.</p>
  </>;
}
