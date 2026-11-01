import { redirect } from "next/navigation";

// Monitor Perusahaan is now part of the dashboard; keep old links working.
export default function Page() {
  redirect("/dashboard#monitor");
}
