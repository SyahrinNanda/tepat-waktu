import type { Metadata } from "next";
import { requireCompanyRole } from "@/lib/current-company";
import { accessRoles, roleAccessRows } from "@/features/access/role-access";

export const metadata: Metadata = { title: "Daftar User Level" };

export default async function Page() {
  await requireCompanyRole(["admin"]);
  return <>
    <div className="master-page-head"><span>Pengaturan</span><h1>User Level</h1><p>Beranda / Pengaturan / User Level</p></div>
    <section className="role-access-card">
      <p className="role-access-intro">Hak akses mengikuti role setiap akun. Role diatur di <strong>Pengaturan → User Login</strong>. Manager hanya melihat karyawan di Divisi yang sama dengan dirinya.</p>
      <div className="role-access-wrap">
        <table className="role-access-table">
          <thead><tr><th>Fitur</th>{accessRoles.map((role) => <th key={role}>{role}</th>)}</tr></thead>
          <tbody>{roleAccessRows.map((row) => <tr key={row.feature}><th scope="row">{row.feature}</th>{row.access.map((value, index) => <td key={accessRoles[index]} className={value === "-" ? "is-none" : /Kelola|Tangani/.test(value) ? "is-full" : ""}>{value === "-" ? "Tidak ada" : value}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
