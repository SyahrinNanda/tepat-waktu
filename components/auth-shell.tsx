import { Logotype } from "./logo";
import { ArrowUpRight, CalendarCheck2, Check, Clock3, ShieldCheck, UsersRound } from "lucide-react";

export function AuthShell({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "login" }) {
  if (variant === "login") {
    return (
      <main className="login-portal-page">
        <div className="login-portal-shell">
          <aside className="login-portal-story">
            <div className="login-story-brand"><Logotype /><span>WORKSPACE</span></div>
            <div className="login-story-copy">
              <span className="login-story-kicker"><i /> OPERATIONS, IN ONE PLACE</span>
              <h2>Kerja hari ini,<br /><em>lebih jelas.</em></h2>
              <p>Kelola kehadiran, jadwal, dan kebutuhan tim dalam satu ruang kerja perusahaan yang rapi.</p>
            </div>
            <div className="login-product-preview" aria-hidden="true">
              <div className="login-preview-top"><span><CalendarCheck2 size={15} /> Ringkasan operasional</span><small><ArrowUpRight size={13} /> LIVE</small></div>
              <div className="login-preview-grid">
                <span><i><UsersRound size={16} /></i><small>Tim aktif</small><strong>48</strong><em>+3 minggu ini</em></span>
                <span><i><Clock3 size={16} /></i><small>Mulai tepat waktu</small><strong>94%</strong><em>Hari ini</em></span>
              </div>
              <div className="login-preview-activity"><b><Check size={13} /></b><span><strong>Jadwal pagi siap berjalan</strong><small>43 anggota tim telah tercatat</small></span><time>08.02</time></div>
            </div>
            <div className="login-story-foot"><ShieldCheck size={15} /><span>Ruang kerja privat untuk setiap perusahaan.</span></div>
          </aside>
          <section className="login-portal-form">
            <div className="login-mobile-brand"><Logotype /></div>
            {children}
            <p className="login-copyright">© 2026 TepatWaktu. Dibuat untuk tim Indonesia.</p>
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Logotype />
        {children}
      </section>
      <aside className="auth-visual" aria-hidden="true">
        <span className="shape-a" />
        <span className="shape-b" />
        <span className="shape-c" />
      </aside>
    </main>
  );
}
