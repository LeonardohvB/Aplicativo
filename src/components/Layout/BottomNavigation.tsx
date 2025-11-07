// src/components/Layout/BottomNavigation.tsx
import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Home, Users, Calendar, DollarSign, BarChart3 } from 'lucide-react'

// TABS
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

/**
 * Regras:
 * - Altura fixa (64px) + safe area (iOS) sem encolher conteúdo.
 * - Ícones fixos em 24px; rótulo fixo em 11px (não deixa o sistema reduzir).
 * - Nada de grow/shrink nos botões.
 */
const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      className={[
        // barra fixa
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white border-t border-gray-200',
        // altura fixa + acolchoamento da área segura (iOS)
        'min-h-[56px] pt-1',
        'pb-[calc(env(safe-area-inset-bottom))]',
      ].join(' ')}
      role="navigation"
      aria-label="Navegação inferior"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-5">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={[
                  // cada botão ocupa a mesma fração e não encolhe
                  'h-[64px] shrink-0',
                  'flex flex-col items-center justify-center gap-0.5',
                  // toque confortável
                  'touch-manipulation select-none',
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Ícone tamanho fixo */}
                <Icon className="h-6 w-6 shrink-0" aria-hidden />
                {/* Rótulo tamanho fixo (11px), sem variação por acessibilidade do SO */}
                <span className="text-[11px] leading-none font-medium not-italic tracking-tight">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default BottomNavigation
