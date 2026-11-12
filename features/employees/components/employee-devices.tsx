"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, HelpCircle, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { confirmAction } from "@/components/confirm-dialog";
import type { DeviceKind } from "@/features/employees/devices";
import { signOutEmployeeDevices } from "@/features/employees/server/device-actions";

export type EmployeeDeviceRow = {
  key: string; kind: DeviceKind; name: string; browser: string; lastUsed: string; lastIp: string | null;
  attendanceCount: number; lastAttendance: string | null; sessionIds: string[];
};

const icons = { mobile: Smartphone, tablet: Tablet, desktop: Monitor, unknown: HelpCircle } as const;
const kindLabels: Record<DeviceKind, string> = { mobile: "HP", tablet: "Tablet", desktop: "Komputer", unknown: "Lainnya" };

/** Daftar Device tab: devices the employee signed in or checked in from, with remote sign-out. */
export function EmployeeDevices({ employeeId, rows, hasAccount, canManage, timeZone }: { employeeId: string; rows: EmployeeDeviceRow[]; hasAccount: boolean; canManage: boolean; timeZone: string }) {
  const router = useRouter();
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, startTransition] = useTransition();
  const signedIn = rows.filter((row) => row.sessionIds.length > 0);
  const formatTime = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));

  async function signOut(target: EmployeeDeviceRow | "all") {
    const message = target === "all" ? `Keluarkan karyawan ini dari semua perangkat (${signedIn.length})? Karyawan harus masuk lagi untuk presensi.` : `Keluarkan dari ${target.name} (${target.browser})? Karyawan harus masuk lagi di perangkat ini.`;
    if (!await confirmAction(message, "Keluarkan dari Perangkat")) return;
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await signOutEmployeeDevices(employeeId, target === "all" ? "all" : target.sessionIds).catch(() => ({ ok: false, error: "Server tidak dapat dihubungi." }) as const);
      if (!result.ok) return setError(result.error);
      setNotice(target === "all" ? "Karyawan sudah dikeluarkan dari semua perangkat." : `Karyawan sudah dikeluarkan dari ${target.name}.`);
      router.refresh();
    });
  }

  return <div className="employee-tab-panel">
    <div className="employee-tab-head"><div><h3>Daftar Device Karyawan</h3><p className="employee-tab-sub">Perangkat yang dipakai karyawan untuk masuk aplikasi dan presensi. Keluarkan perangkat yang hilang atau sudah tidak dipakai.</p></div>
      {canManage && signedIn.length > 0 && <button type="button" className="btn btn-outline employee-tab-action" disabled={pending} onClick={() => signOut("all")}><LogOut size={15}/> Keluarkan dari Semua Perangkat</button>}</div>
    {!hasAccount && <div className="employee-tab-note">Karyawan ini belum punya akun login, jadi belum ada perangkat yang masuk aplikasi.</div>}
    {error && <div className="announcement-inline-error">{error}</div>}
    {notice && <div className="employee-tab-success">{notice}</div>}
    <div className="table-scroll"><table className="employee-tab-table employee-device-table">
      <thead><tr><th>#</th><th>Perangkat</th><th>Browser</th><th>Terakhir Aktif</th><th>Presensi</th><th>Alamat IP</th><th>Status</th>{canManage && <th aria-label="Aksi"/>}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const Icon = icons[row.kind];
        return <tr key={row.key}>
          <td>{index + 1}</td>
          <td><div className="employee-device-name"><span><Icon size={17}/></span><div><strong>{row.name}</strong><small>{kindLabels[row.kind]}</small></div></div></td>
          <td>{row.browser}</td>
          <td>{formatTime(row.lastUsed)}</td>
          <td>{row.attendanceCount ? <>{row.attendanceCount} kali{row.lastAttendance && <small>terakhir {formatTime(row.lastAttendance)}</small>}</> : "–"}</td>
          <td>{row.lastIp || "–"}</td>
          <td>{row.sessionIds.length ? <span className="badge green">Sedang masuk</span> : <span className="badge gray">Sudah keluar</span>}</td>
          {canManage && <td>{row.sessionIds.length > 0 && <details className="employee-row-menu"><summary aria-label="Aksi perangkat"><Ellipsis size={18}/></summary><div data-float-menu>
            <button type="button" className="danger" disabled={pending} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void signOut(row); }}><LogOut size={15}/> Keluarkan dari Perangkat</button>
          </div></details>}</td>}
        </tr>;
      })}</tbody>
    </table>{!rows.length && <div className="location-empty"><strong>Data Kosong</strong><span>Belum ada perangkat yang tercatat untuk karyawan ini.</span></div>}</div>
  </div>;
}
