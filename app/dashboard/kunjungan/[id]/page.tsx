import { redirect } from "next/navigation";

// Visits open in a modal on the list; this old detail route read the generic records table and showed
// "Data tidak ditemukan" for real visits, so it now leads back to the list.
export default function Page() { redirect("/dashboard/kunjungan"); }
