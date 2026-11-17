import { redirect } from "next/navigation";

// Visit reports open from the report list; the old detail route showed "Data tidak ditemukan".
export default function Page() { redirect("/dashboard/kunjungan/laporan"); }
