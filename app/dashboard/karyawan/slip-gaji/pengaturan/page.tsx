import { redirect } from "next/navigation";

// Moved to Master Data → Perhitungan Gaji (17 Nov 2026); old links and bookmarks still work.
export default function Page() {
  redirect("/dashboard/master/perhitungan-gaji");
}
