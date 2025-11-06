// src/components/ui/Surface.tsx
import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export default function Surface({ padded = true, className = "", ...rest }: Props) {
  return (
    <div
      className={[
        "rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition",
        padded ? "p-4 sm:p-5" : "",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}
