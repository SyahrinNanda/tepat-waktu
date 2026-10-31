"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function VerificationRedirect() {
  const router = useRouter();
  useEffect(() => { const timer = window.setTimeout(() => router.replace("/"), 2500); return () => window.clearTimeout(timer); }, [router]);
  return null;
}
