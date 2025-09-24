import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
}>;

export default function Section({ children, className }: Props) {
  // These paddings must match stat tiles container paddings so edges align
  return (
    <div className={`w-full px-5 sm:px-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}