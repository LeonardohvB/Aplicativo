// src/App.tsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ensureProfile } from './lib/ensureProfile'
import Profile from './pages/Profile'
import BottomNavigation, { Tab } from './components/Layout/BottomNavigation'
import Dashboard from './pages/Dashboard'
import Professionals from './pages/Professionals'
import Schedule from './pages/Schedule'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import LoginGate from './pages/LoginGate'
import OverlayMenu from './components/common/OverlayMenu'
import PatientsNew from './pages/PatientsNew' // ⟵ NOVO

// Aceita também “rotas” internas de tela cheia
type AppTab = Tab | 'perfil' | 'patients_new' // ⟵ mantém

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('inicio')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [user, setUser] = useState<any>(null)

  const onlyFirst = (full?: string | null) => {
    if (!full) return null
    const p = full.trim().split(/\s+/)
    return p[0] || null
  }
  const [firstName, setFirstName] = useState<string | null>(null)

  // ===== sessão / auth =====
  useEffect(() => {
    let unsub = () => {}

    ;(async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) console.warn('getSession error:', error)
      setUser(session?.user ?? null)

      if (session?.user) {
        try { await ensureProfile() } catch (e) { console.warn('ensureProfile(getSession) error:', e) }
      }

      setCheckingAuth(false)

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
        setUser(sess?.user ?? null)
        if (sess?.user) {
          try { await ensureProfile() } catch (e) { console.warn('ensureProfile(onAuth) error:', e) }
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })()

    return () => unsub()
  }, [])

  // ===== nome do usuário =====
  useEffect(() => {
    if (!user) return

    let canceled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()

      if (!canceled) {
        if (error) console.warn('fetch profile name error:', error)
        setFirstName(onlyFirst(row?.name ?? null))
      }
    })()

    return () => { canceled = true }
  }, [user])

  useEffect(() => {
    const onSaved = (e: any) => setFirstName(onlyFirst(e?.detail?.name ?? null))
    window.addEventListener('profile:saved', onSaved)
    return () => window.removeEventListener('profile:saved', onSaved)
  }, [])

  // ===== carregando / login =====
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Carregando…</span>
      </div>
    )
  }

  if (!user) return <LoginGate />

  // cast temporário para aceitar a prop firstName em Dashboard
  const DashboardComp: any = Dashboard

  // ===== conteúdo por aba =====
  const renderContent = () => {
    switch (activeTab) {
      case 'profissionais': return <Professionals />
      case 'agenda':        return <Schedule />
      case 'financeiro':    return <Finance />
      case 'relatorios':    return <Reports />
      case 'patients_new':  // ⟵ tela inteira de cadastro de paciente
        return (
          <PatientsNew
            onBack={() => setActiveTab('agenda')}
            onCreated={() => setActiveTab('agenda')}
          />
        )
      case 'perfil':        return <Profile onBack={() => setActiveTab('inicio')} />
      default:
        return (
          <DashboardComp
            firstName={firstName ?? undefined}
            onOpenProfile={() => setActiveTab('perfil')}
            onGotoSchedule={(filter: 'today' | 'week') => {
              setActiveTab('agenda')
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('agenda:filter', { detail: filter }))
              }, 0)
            }}
          />
        )
    }
  }

  return (
    <>
      {/* Wrapper de viewport: rolagem só aqui */}
      <div className="app-viewport min-h-screen overflow-y-auto overscroll-contain bg-gray-50 relative">
        {/* Menu suspenso fixo em TODAS as abas */}
        <div className="fixed right-4 top-4 z-40">
        <OverlayMenu
  onOpenProfile={() => setActiveTab('perfil')}
  onOpenNewPatient={() => setActiveTab('patients_new')}
  onOpenNewProfessional={() => {
    setActiveTab('profissionais');
    setTimeout(() => window.dispatchEvent(new CustomEvent('professionals:add')), 0);
  }}
  onOpenHistory={() => {                 // ← NOVO
    setActiveTab('agenda');              // vai para Agenda
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('agenda:openHistory')); // sinal para abrir o modal
    }, 0);
  }}
/>

        </div>

        {renderContent()}

        {/* BottomNavigation só conhece Tabs “normais”.
            Se estiver em 'perfil' ou 'patients_new', mostramos 'inicio' para não quebrar tipagem. */}
        <BottomNavigation
          activeTab={
            activeTab === 'perfil' || activeTab === 'patients_new'
              ? 'inicio'
              : (activeTab as Tab)
          }
          onTabChange={(t: Tab) => setActiveTab(t)}
        />
      </div>
    </>
  )
}
