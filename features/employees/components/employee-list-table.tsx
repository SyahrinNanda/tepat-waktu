"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Ellipsis, UserRound, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteEmployee, updateEmployeeLocks } from "@/features/workforce/server/actions";

const accountLabel = { active: "Aktif", pending: "Menunggu undangan", expired: "Undangan kedaluwarsa", none: "Belum ada" } as const;
const accountTitle = { active: "Sudah bisa login", pending: "Undangan terkirim, belum membuat password", expired: "Tautan undangan kedaluwarsa; kirim ulang dari detail karyawan", none: "Belum punya akun login; buat dari detail karyawan" } as const;

export type EmployeeListRow = {
  id: string; employeeCode: string; name: string; email: string; department: string; position: string;
  status: "active" | "inactive"; account: "active" | "pending" | "expired" | "none"; allAttendanceLocations: boolean; contractType: string | null; photoAssetId: string | null;
  lockLocation: boolean; lockPhoto: boolean;
};

export function EmployeeListTable({ rows, canManage }: { rows: EmployeeListRow[]; canManage: boolean }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListRow | null>(null);
  const [busy, startTransition] = useTransition();
  const remove = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    });
  };
  if (!rows.length) return <div className="location-empty"><Users size={46}/><strong>Data Kosong</strong><span>Karyawan tidak ditemukan.</span></div>;
  return <>
    <div className="table-scroll"><table className="employee-list-table"><thead><tr><th>#</th><th>Foto</th><th>Nama Karyawan</th><th>Jabatan–Divisi</th><th>Akun Login</th><th>Lokasi Kerja</th><th>Kunci Pengaturan</th><th>Tipe Kontrak</th><th>Aksi</th></tr></thead><tbody>
      {rows.map((row, index) => <tr key={row.id} className={row.status === "inactive" ? "employee-inactive-row" : undefined}>
        <td>{index + 1}</td>
        <td>{row.photoAssetId ? <Image className="employee-photo" src={`/api/files/${row.photoAssetId}`} alt={row.name} width={56} height={56} unoptimized/> : <span className="employee-photo-placeholder"><UserRound size={38}/></span>}</td>
        <td><span className="employee-code">NI: {row.employeeCode}</span><Link href={`/dashboard/karyawan/${row.id}`}>{row.name}</Link><small>{row.email}</small></td>
        <td><strong>{row.position}</strong><small>{row.department}</small></td>
        <td><span className={`account-pill ${row.account}`} title={accountTitle[row.account]}>{accountLabel[row.account]}</span></td>
        <td>{row.allAttendanceLocations ? "Semua Lokasi" : "Lokasi Tertentu"}</td>
        <td><LockMenu row={row} disabled={!canManage}/></td>
        <td>{row.contractType || "–"}</td>
        <td><details className="employee-action-menu"><summary aria-label={`Aksi ${row.name}`}><Ellipsis size={19}/></summary><div data-float-menu><Link href={`/dashboard/karyawan/${row.id}` as Route}>Detail</Link>{canManage && <Link href={`/dashboard/karyawan/${row.id}/edit` as Route}>Edit</Link>}{canManage && <button type="button" onClick={() => setDeleteTarget(row)}>Hapus</button>}</div></details></td>
      </tr>)}
    </tbody></table></div>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus Karyawan?" message={`Data ${deleteTarget?.name ?? "karyawan"} beserta riwayat terkait akan dihapus permanen.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
  </>;
}

function LockMenu({ row, disabled }: { row: EmployeeListRow; disabled: boolean }) {
  const [locks, setLocks] = useState({ location: row.lockLocation, photo: row.lockPhoto });
  const [pending, startTransition] = useTransition();
  const toggle = (key: keyof typeof locks) => {
    if (disabled || pending) return;
    const previous = locks;
    const next = { ...locks, [key]: !locks[key] };
    setLocks(next);
    startTransition(async () => { try { await updateEmployeeLocks(row.id, next); } catch { setLocks(previous); } });
  };
  const label = locks.location && locks.photo ? "Lokasi & Foto" : locks.location ? "Kunci Lokasi" : locks.photo ? "Kunci Foto" : "Tanpa kunci";
  return <details className="employee-lock-menu"><summary>{pending ? "Menyimpan..." : label}<ChevronDown size={13}/></summary><div data-float-menu className="employee-lock-options">
    <button type="button" disabled={disabled} onClick={() => toggle("location")}><span><strong>Kunci Lokasi</strong><small>{locks.location ? "Wajib mencatat kehadiran di dalam radius lokasi kerja" : "Boleh mencatat kehadiran di luar radius lokasi kerja"}</small></span>{locks.location && <Check size={14}/>}</button>
    <button type="button" disabled={disabled} onClick={() => toggle("photo")}><span><strong>Kunci Foto</strong><small>{locks.photo ? "Wajib mengirim foto saat mencatat kehadiran" : "Foto boleh tidak dikirim"}</small></span>{locks.photo && <Check size={14}/>}</button>
  </div></details>;
}
