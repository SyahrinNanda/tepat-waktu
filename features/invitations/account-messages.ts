/** Messages for the ?akun=... outcome codes (employee login account / invitation). Shared by server and client. */
export function employeeAccountMessage(code: string | undefined, email: string): { tone: "success" | "warning" | "error"; text: string } | null {
  switch (code) {
    case "invited": return { tone: "success", text: `Akun login dibuat dan email undangan dikirim ke ${email}. Karyawan membuat password sendiri lewat tautan di email (berlaku 7 hari).` };
    case "resent": return { tone: "success", text: `Undangan baru dikirim ke ${email}. Tautan sebelumnya tidak berlaku lagi.` };
    case "email_updated": return { tone: "success", text: `Email akun ikut diperbarui dan undangan baru dikirim ke ${email}.` };
    case "linked": return { tone: "success", text: "Email ini sudah punya akun di perusahaan ini, jadi akun tersebut ditautkan ke data karyawan." };
    case "already_active": return { tone: "warning", text: "Karyawan ini sudah punya akun aktif; tidak ada undangan yang dikirim." };
    case "cooldown": return { tone: "warning", text: "Undangan ke email ini baru saja dikirim. Untuk mencegah spam, pengiriman ulang dibatasi bertahap (1 menit, 5 menit, 1 jam, 5 jam, lalu 24 jam). Coba lagi nanti." };
    case "email_kept": return { tone: "warning", text: "Data karyawan diperbarui. Karyawan sudah membuat password, jadi email login-nya tidak diubah. Untuk mengganti email login, hubungi admin TepatWaktu." };
    case "email_taken": return { tone: "error", text: `Email ${email} sudah dipakai akun lain, jadi email login karyawan tidak diubah.` };
    case "email_failed": return { tone: "error", text: "Email undangan gagal dikirim. Coba lagi dengan tombol Kirim ulang undangan." };
    case "other_company": return { tone: "error", text: `Email ${email} sudah dipakai akun di perusahaan lain, jadi akun login tidak dibuat. Ganti email karyawan, lalu klik Buat akun & kirim undangan.` };
    case "superadmin": return { tone: "error", text: "Email ini milik akun Superadmin dan tidak bisa dipakai sebagai akun karyawan." };
    case "linked_elsewhere": return { tone: "error", text: "Akun dengan email ini sudah tertaut ke data karyawan lain di perusahaan ini." };
    case "inactive": return { tone: "error", text: "Karyawan nonaktif tidak bisa diberi akun login. Aktifkan karyawan terlebih dahulu." };
    default: return null;
  }
}
