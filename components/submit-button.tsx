"use client";

import { useFormStatus } from "react-dom";

/** `pending`: pass it when the form submits through onSubmit (useFormStatus only sees form actions). */
export function SubmitButton({ children, className = "btn btn-primary", pendingLabel = "Menyimpan...", pending: pendingProp }: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return <button className={className} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
