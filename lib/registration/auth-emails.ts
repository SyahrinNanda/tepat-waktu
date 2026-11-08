import { escapeHtml, sendMail } from "@/lib/mailer";

/** Account emails sent by Better Auth (see lib/auth.ts). */
export type AuthEmailKind = "signup" | "recovery";

const content: Record<AuthEmailKind, { subject: string; eyebrow: string; title: string; body: string; cta: string; note: string }> = {
  signup: {
    subject: "Verifikasi email akun TepatWaktu Anda",
    eyebrow: "Verifikasi email",
    title: "Satu langkah lagi untuk mulai memakai TepatWaktu",
    body: "Terima kasih telah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda. Setelah itu ruang kerja perusahaan Anda langsung dibuat.",
    cta: "Verifikasi Email",
    note: "Jika Anda tidak merasa mendaftar di TepatWaktu, abaikan email ini.",
  },
  recovery: {
    subject: "Atur ulang password TepatWaktu",
    eyebrow: "Reset password",
    title: "Permintaan atur ulang password",
    body: "Kami menerima permintaan untuk mengatur ulang password akun Anda. Klik tombol di bawah untuk membuat password baru.",
    cta: "Atur Password Baru",
    note: "Tautan hanya bisa dipakai sekali dan segera kedaluwarsa. Jika Anda tidak meminta reset password, abaikan email ini; password Anda tidak berubah.",
  },
};

export type BrandedEmail = { subject: string; eyebrow: string; title: string; body: string; cta?: string; url?: string; note?: string };

/** TepatWaktu-branded email (HTML + plain text). The button is shown only when `cta` and `url` are set. */
export function renderBrandedEmail(c: BrandedEmail) {
  const button = c.cta && c.url;
  const text = [c.title, "", c.body, ...(button ? ["", `${c.cta}: ${c.url}`] : []), ...(c.note ? ["", c.note] : []), "", "Salam,", "Tim TepatWaktu"].join("\n");
  const safeUrl = escapeHtml(c.url ?? "");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f1d1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:20px 28px;background:#faa30e;font-size:20px;font-weight:800;color:#1f1d1b">Tepat<span style="color:#ffffff">Waktu</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#b05c07;text-transform:uppercase">${escapeHtml(c.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(c.title)}</h1>
<p style="margin:0 0 24px;line-height:1.6;white-space:pre-line">${escapeHtml(c.body)}</p>
${button ? `<a href="${safeUrl}" style="display:inline-block;padding:13px 22px;background:#faa30e;color:#3a2200;font-weight:800;text-decoration:none;border-radius:999px">${escapeHtml(c.cta!)}</a>
<p style="margin:24px 0 0;font-size:12px;color:#7a746c;line-height:1.6">Jika tombol tidak berfungsi, salin tautan ini ke browser:<br><a href="${safeUrl}" style="color:#b05c07;word-break:break-all">${safeUrl}</a></p>` : ""}
${c.note ? `<p style="margin:16px 0 0;font-size:12px;color:#7a746c;line-height:1.6">${escapeHtml(c.note)}</p>` : ""}
</td></tr></table></body></html>`;
  return { subject: c.subject, html, text };
}

export function authEmail(kind: AuthEmailKind, url: string) {
  return renderBrandedEmail({ ...content[kind], url });
}

/**
 * Sends an account email through the provider fallback. Never throws: Better Auth recommends not
 * awaiting delivery (timing attacks), and a failed send is logged and can be retried by the user
 * ("kirim ulang" on the verification page, or by logging in again).
 */
export function sendAuthEmail(kind: AuthEmailKind, to: string, url: string) {
  void sendMail({ to: [to], ...authEmail(kind, url) })
    .then((delivery) => console.info(`Email ${kind} untuk ${to} dikirim lewat ${delivery.label}.`))
    .catch((error) => console.error(`Email ${kind} untuk ${to} gagal dikirim:`, error instanceof Error ? error.message : error));
}

/**
 * Login code for members with "OTP Login" on (Better Auth twoFactor plugin). Awaited, so the login
 * screen can tell the user when the code could not be sent.
 */
export async function sendLoginOtpEmail(to: string, otp: string) {
  const email = renderBrandedEmail({
    subject: `${otp} adalah kode masuk TepatWaktu Anda`,
    eyebrow: "Kode masuk",
    title: `Kode masuk Anda: ${otp}`,
    body: "Masukkan kode ini di halaman login TepatWaktu untuk melanjutkan. Kode berlaku 5 menit dan hanya bisa dipakai sekali.",
    note: "Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku dari TepatWaktu. Jika Anda tidak sedang masuk, segera ganti password akun Anda.",
  });
  const delivery = await sendMail({ to: [to], ...email });
  console.info(`Email kode masuk untuk ${to} dikirim lewat ${delivery.label}.`);
}
