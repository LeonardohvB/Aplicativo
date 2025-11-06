// src/components/layout/ResponsiveGrid.tsx
import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  cols?: { base?: number; md?: number; lg?: number; xl?: number };
  gap?: string; // ex: "gap-4"
};

export default function ResponsiveGrid({
  cols = { base: 1, md: 2, xl: 4 },
  gap = "gap-4",
  className = "",
  ...rest
}: Props) {
  const { base = 1, md = 2, lg, xl = 4 } = cols;
  const cls = [
    "grid",
    `grid-cols-${base}`,
    md ? `md:grid-cols-${md}` : "",
    lg ? `lg:grid-cols-${lg}` : "",
    xl ? `xl:grid-cols-${xl}` : "",
    gap,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls} {...rest} />;
}
