// src/components/ui/KpiCard.tsx
import React from "react";
import Surface from "./Surface";

type Props = {
  title: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconBg?: string;   // ex: "bg-blue-100 text-blue-700"
  onClick?: () => void;
  rightAction?: React.ReactNode; // pode ser um <button/> sem gerar nesting
};

export default function KpiCard({
  title,
  value,
  icon: Icon,
  iconBg = "bg-blue-100 text-blue-700",
  onClick,
  rightAction,
}: Props) {
  const interactive = typeof onClick === "function";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={interactive ? "cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/30 rounded-2xl" : ""}
    >
      <Surface className="h-full">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className={`inline-flex w-9 h-9 rounded-xl ${iconBg} items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div>
              <p className="text-sm text-slate-600">{title}</p>
              <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
            </div>
          </div>

          {/* IMPORTANTE: se rightAction for um <button>, não terá mais nesting */}
          {rightAction}
        </div>
      </Surface>
    </div>
  );
}
