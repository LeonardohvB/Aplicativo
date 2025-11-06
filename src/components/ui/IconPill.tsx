import React from "react";

/**
 * Pill do ícone idêntico ao usado nos KPIs (StatCard):
 * - Tamanho: w-10 h-10
 * - Raio: rounded-2xl
 * - Texto branco (ícones Lucide herdam currentColor)
 * - Leve ring/sombra para realçar igual aos cards
 *
 * Se quiser sólido em vez de gradiente, troque o mapa 'grad'.
 */
type Color = "blue" | "purple" | "green" | "orange";
type Props = { color: Color; className?: string; children: React.ReactNode };

export default function IconPill({ color, className = "", children }: Props) {
  // Gradientes parecidos com o visual dos KPIs
  const grad: Record<Color, string> = {
    blue:   "from-indigo-500 to-indigo-600",
    purple: "from-fuchsia-500 to-violet-600",
    green:  "from-emerald-500 to-emerald-600",
    orange: "from-amber-500 to-orange-600",
  };

  return (
    <span
      className={[
        "inline-flex w-10 h-10 rounded-2xl items-center justify-center",
        "bg-gradient-to-b",            // gradiente
        grad[color],
        "text-white",                  // ícone branco (igual KPI)
        "ring-1 ring-black/5 shadow-sm", // acabamento semelhante
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
