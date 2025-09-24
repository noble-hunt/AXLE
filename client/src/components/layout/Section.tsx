import React from "react";

/**
 * Mobile-first page gutter that matches Privacy card width.
 * Use this wrapper for EVERY block on the Health page.
 * px-6 = 24px per side on mobile. Adjust here if you ever change the design.
 */
export default function Section({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`w-full px-6 ${className ?? ""}`}>{children}</div>;
}