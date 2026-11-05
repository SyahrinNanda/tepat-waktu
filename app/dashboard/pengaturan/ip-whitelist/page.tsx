import type { Metadata } from "next";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { requireCompanyRole } from "@/lib/current-company";
import { fetchIpWhitelistsAction } from "./actions";
import { IpWhitelistManager } from "./ip-whitelist-manager";

export const metadata: Metadata = { title: "Daftar IP Whitelist" };

export default async function Page() {
  await requireCompanyRole(["admin"]);
  const items = await fetchIpWhitelistsAction();
  const currentIp = clientIp(await headers());

  return (
    <>
    <div className="ip-whitelist-info" role="note">
      <p><strong>{items.length ? "IP Whitelist aktif." : "IP Whitelist belum aktif."}</strong> {items.length
        ? "Karyawan hanya bisa check-in dan check-out dari alamat IP di daftar ini. Hapus semua IP untuk mematikan pembatasan."
        : "Selama daftar kosong, presensi bisa dilakukan dari jaringan mana pun. Begitu satu IP ditambahkan, presensi hanya bisa dari IP yang terdaftar."}</p>
      <p>IP publik jaringan Anda saat ini: <code>{currentIp ?? "tidak terdeteksi"}</code>. Buka halaman ini dari Wi-Fi kantor untuk mengetahui IP kantor.</p>
    </div>
    <IpWhitelistManager
      key={items.map((i) => `${i.id}:${i.ip}`).join(";")}
      initialItems={items}
    />
    </>
  );
}
