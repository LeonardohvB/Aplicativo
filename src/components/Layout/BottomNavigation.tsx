// src/components/Layout/BottomNavigation.tsx
import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Home, Users, Calendar, DollarSign, BarChart3 } from 'lucide-react'

export type Tab = 'inicio' | 'profissionais' | 'agenda' | 'financeiro' | 'relatorios'

interface BottomNavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'inicio',        label: 'Início',        icon: Home },
  { id: 'profissionais', label: 'Profissionais', icon: Users },
  { id: 'agenda',        label: 'Agenda',        icon: Calendar },
  { id: 'financeiro',    label: 'Financeiro',    icon: DollarSign },
  { id: 'relatorios',    label: 'Relatórios',    icon: BarChart3 },
]

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200
        h-[64px] md:h-[56px]
        pb-[env(safe-area-inset-bottom)]
        z-50
      "
    >
      {/* ancorado no rodapé pra 'descer' os ícones */}
      <div className="h-full flex items-end justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center gap-0.5 pb-2 px-3 rounded-lg transition
                          ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="text-[11px] leading-4">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNavigation
