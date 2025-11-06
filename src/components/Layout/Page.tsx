// src/components/layout/Page.tsx
import React from "react";

type PageProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode; // botões do canto superior direito
  children: React.ReactNode;
  fullWidth?: boolean; // se true, usa 100% da largura
};

export default function Page({
  title,
  subtitle,
  actions,
  children,
  fullWidth,
}: PageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className={[
          "mx-auto w-full py-6",
          fullWidth
            ? "px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14"
            : "px-4 sm:px-6 lg:px-8 max-w-7xl",
        ].join(" ")}
      >
        {(title || actions) && (
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              {subtitle && (
                <p className="text-slate-500 text-sm leading-6">{subtitle}</p>
              )}
              {title && (
                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
        )}

        <main>{children}</main>
      </div>
    </div>
  );
}
