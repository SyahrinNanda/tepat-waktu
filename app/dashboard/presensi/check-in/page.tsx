import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttendanceCheckin } from "@/features/attendance/components/attendance-checkin";
import { requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Check-in & Check-out" };

export default async function Page() {
  const context = await requireCompany();
  if (["admin", "owner"].includes(context.role)) redirect("/dashboard");
  return <AttendanceCheckin />;
}
