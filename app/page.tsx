import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthShell variant="login">
      <div className="auth-main login-auth-main">
        <span className="login-form-kicker">PORTAL PERUSAHAAN</span>
        <h1>Selamat datang kembali</h1>
        <p className="login-form-lead">Masuk untuk melanjutkan pekerjaan bersama tim Anda.</p>
        <LoginForm />
      </div>
    </AuthShell>
  );
}
