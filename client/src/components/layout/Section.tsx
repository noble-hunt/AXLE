import React from "react";

/**
 * Page gutter for the Health screen.
 * Use a slightly smaller padding to make content WIDER.
 * This matches the original Privacy card visual width.
 *
 * Mobile:  px-4  (16px per side)
 * >=sm:    px-5  (20px per side)
 * >=md:    px-6  (24px per side) – optional headroom on tablets
 */
export default function Section({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`w-full px-4 sm:px-5 md:px-6 ${className ?? ""}`}>{children}</div>;
}