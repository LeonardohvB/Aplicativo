// src/components/Layout/BottomNavigation.tsx
import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Home, Users, Calendar, DollarSign, BarChart3 } from 'lucide-react'

// 1) Tipo único para as abas
export type Tab = 'inicio' | 'profissionais' | 'agenda' | 'financeiro' | 'relatorios'

// 2) Props do componente usando o tipo Tab
interface BottomNavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

// 3) Tipar o array de abas para que id seja Tab
const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'inicio',        label: 'Início',        icon: Home },
  { id: 'profissionais', label: 'Profissionais', icon: Users },
  { id: 'agenda',        label: 'Agenda',        icon: Calendar },
  { id: 'financeiro',    label: 'Financeiro',    icon: DollarSign },
  { id: 'relatorios',    label: 'Relatórios',    icon: BarChart3 },
]

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNavigation
