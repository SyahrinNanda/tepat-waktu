"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
// After a successful verification the user is already signed in: continue to the dashboard.
export function VerificationRedirect() {
  const router = useRouter();
  useEffect(() => { const timer = window.setTimeout(() => router.replace("/masuk/lanjut"), 2500); return () => window.clearTimeout(timer); }, [router]);
  return null;
}
