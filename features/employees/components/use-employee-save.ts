"use client";

import { useRef, useState, useTransition } from "react";
import type { EmployeeFormState } from "@/features/workforce/server/actions";

/**
 * Submits an employee form through a server action that returns `{ error }` instead of throwing,
 * so a rejected save (email already used, plan limit, bad file) shows a message in the form and
 * keeps everything the user typed. On success the action redirects.
 */
export function useEmployeeSave(action: (form: FormData) => Promise<EmployeeFormState>) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      const result = await action(form);
      if (result?.error) {
        setError(result.error);
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
      }
    });
  }
  return { error, pending, onSubmit, errorRef };
}
