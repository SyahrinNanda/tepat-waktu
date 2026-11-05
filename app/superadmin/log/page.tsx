import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/superadmin";
import { AuditLogPage } from "@/features/platform-admin/pages/audit-log-page";

export const metadata: Metadata = { title: "Log Aktivitas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ action?: string; q?: string; range?: string; page?: string }> }) {
  await requireSuperAdmin();
  return <AuditLogPage params={await searchParams} />;
}
