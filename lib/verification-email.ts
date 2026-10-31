export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim() && !process.env.EMAIL_FROM.includes("domain-anda.id"));
}

export class EmailDeliveryError extends Error {
  constructor(message: string, public readonly reason: "configuration" | "sender" | "rate_limit" | "service" | "network") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendVerificationLink(email: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!emailDeliveryConfigured() || !key || !from) throw new EmailDeliveryError("Pengiriman email belum dikonfigurasi. Isi RESEND_API_KEY dan EMAIL_FROM dengan alamat pengirim yang valid.", "configuration");

  const safeUrl = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "TepatWaktu/1.0",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "TepatWaktu: Verifikasi email Anda",
      html: `<div style="max-width:620px;margin:auto;padding:32px;font-family:Arial,sans-serif;color:#17324d"><h1 style="color:#0878df">TepatWaktu</h1><p>Terima kasih telah mendaftar. Klik tombol berikut untuk mengaktifkan akun perusahaan Anda.</p><p style="margin:30px 0"><a href="${safeUrl}" style="background:#0878df;color:white;padding:14px 22px;border-radius:7px;text-decoration:none;font-weight:bold">Verifikasi email</a></p><p>Atau buka tautan ini: <a href="${safeUrl}">${safeUrl}</a></p><p>Tautan berlaku selama 30 menit. Abaikan email ini jika Anda tidak mendaftar.</p></div>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Koneksi Resend gagal:", error instanceof Error ? error.name : "unknown");
    throw new EmailDeliveryError("Tidak dapat menghubungi layanan email. Silakan coba lagi.", "network");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { name?: string; message?: string };
    console.error("Resend gagal mengirim email verifikasi:", response.status, detail.name ?? "unknown");
    if (response.status === 429) throw new EmailDeliveryError("Batas pengiriman email sedang tercapai. Silakan coba lagi beberapa saat.", "rate_limit");
    if (response.status === 403 && detail.message?.includes("You can only send testing emails to your own email address")) {
      throw new EmailDeliveryError("Pengirim onboarding@resend.dev hanya dapat mengirim ke email pemilik akun Resend. Untuk mengirim ke alamat lain, verifikasi domain Anda di Resend dan ubah EMAIL_FROM.", "sender");
    }
    if (response.status === 401) throw new EmailDeliveryError("RESEND_API_KEY ditolak. Periksa kembali API key Resend Anda.", "configuration");
    if ([400, 403, 422].includes(response.status)) throw new EmailDeliveryError("Alamat pengirim atau izin API key Resend tidak valid. Periksa EMAIL_FROM dan pengaturan Resend.", "sender");
    throw new EmailDeliveryError("Layanan email sedang tidak tersedia. Silakan coba lagi.", "service");
  }
  const result = await response.json().catch(() => ({})) as { id?: string };
  if (!result.id) throw new EmailDeliveryError("Resend belum mengonfirmasi pengiriman email. Silakan coba lagi.", "service");
}
