import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Shown when the plan's active-employee limit is reached. */
export function EmployeeLimitNotice({ message, canUpgrade }: { message: string; canUpgrade: boolean }) {
  return <div className="employee-limit-notice" role="alert">
    <AlertTriangle size={18} aria-hidden="true" />
    <p>{message}</p>
    {canUpgrade && <Link className="btn btn-primary btn-sm" href="/dashboard/langganan/paket">Lihat paket</Link>}
  </div>;
}
