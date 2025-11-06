// src/components/Layout/BottomNavigation.tsx
import React from "react";
import type { LucideIcon } from "lucide-react";
import { Home, Users, Calendar, DollarSign, BarChart3 } from "lucide-react";

export type Tab = "inicio" | "profissionais" | "agenda" | "financeiro" | "relatorios";

interface BottomNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "inicio",        label: "Início",        icon: Home },
  { id: "profissionais", label: "Profissionais", icon: Users },
  { id: "agenda",        label: "Agenda",        icon: Calendar },
  { id: "financeiro",    label: "Financeiro",    icon: DollarSign },
  { id: "relatorios",    label: "Relatórios",    icon: BarChart3 },
];

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="
        fixed inset-x-0 bottom-0
        z-[100]                          /* fica sempre acima dos cards */
        bg-white/95 backdrop-blur
        border-t border-gray-200
        h-[64px] md:h-[72px]             /* altura fixa da barra */
        px-2
        [padding-bottom:env(safe-area-inset-bottom)]
      "
      role="navigation"
      aria-label="Barra inferior"
    >
      <div className="mx-auto h-full max-w-7xl">
        <div className="flex h-full items-center justify-around">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={[
                  "flex h-full flex-col items-center justify-center rounded-lg px-3 transition",
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;
