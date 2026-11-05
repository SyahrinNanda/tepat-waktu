"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a modal at the end of <body>. Use it for dialogs opened from inside a table row or any
 * container with overflow/transform, so table and card styles cannot clip or squeeze the dialog.
 * Only render it after user interaction (the dialog is open), never during server rendering.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
