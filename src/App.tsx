import { useEffect, useState } from 'react'
import { setupDatabase } from './lib/database-setup'
import BottomNavigation from './components/Layout/BottomNavigation'
import Dashboard from './pages/Dashboard'
import Professionals from './pages/Professionals'
import Schedule from './pages/Schedule'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import { getCurrentSession, onAuthChange, signOut } from './lib/auth'
import Login from './pages/Login'
import { enableWebPush, disableWebPush } from './lib/push'
import { getOrCreateOwnProfile } from './lib/profiles'

function App() {
  const [sessionUser, setSessionUser] = useState<{ id: string } | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)
  const [activeTab, setActiveTab] = useState<'inicio' | 'profissionais' | 'agenda' | 'financeiro' | 'relatorios'>('inicio')

  // ---- LOGOUT otimista ----
  const handleLogout = async () => {
    // 1) Derruba a sessão na UI imediatamente
    setSessionUser(null)
    setActiveTab('inicio')
    setIsInitializing(true)
    setCheckingAuth(false)

    // 2) Tenta desativar push (não bloqueia a UI)
    try { await disableWebPush() } catch (e) { console.warn('disableWebPush:', e) }

    // 3) Invalida sessão no Supabase (se falhar, já estamos fora mesmo)
    try { await signOut() } catch (e) { console.error('signOut:', e) }

    // 4) Fallback hard (caso algum estado zumbi continue na tela)
    setTimeout(() => {
      if (!sessionUser) {
        window.location.replace(window.location.origin)
      }
    }, 100)
  }

  // 1) Descobrir sessão e escutar mudanças
  useEffect(() => {
    let unsub: undefined | (() => void)

    ;(async () => {
      try {
        const s = await getCurrentSession()
        setSessionUser(s.user ? { id: s.user.id } : null)
      } catch (e) {
        console.error('auth bootstrap', e)
        setSessionUser(null)
      } finally {
        setCheckingAuth(false) // ← garante que sai do “Carregando…”
      }

      const { data: sub } = onAuthChange(async () => {
        try {
          const s = await getCurrentSession()
          setSessionUser(s.user ? { id: s.user.id } : null)
        } catch (e) {
          console.error('onAuthChange', e)
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })()

    return () => { if (unsub) unsub() }
  }, [])

  // 2) Inicialização do app (só DEPOIS do login)
  useEffect(() => {
    if (!sessionUser) return
    ;(async () => {
      try {
        await setupDatabase()
      } catch (error) {
        console.error('Erro na inicialização:', error)
      } finally {
        setIsInitializing(false)
      }
    })()
  }, [sessionUser])

  // 3) Registrar Web Push (opcional / depois do login)
  useEffect(() => {
    if (!sessionUser) return
    ;(async () => {
      try {
        const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT_ID
        const profile = await getOrCreateOwnProfile(DEFAULT_TENANT)
        await enableWebPush({ userId: sessionUser.id, tenantId: profile.tenant_id })
      } catch (e) {
        console.warn('enableWebPush falhou', e)
      }
    })()
  }, [sessionUser])

  // 4) Guards de renderização
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Carregando</h2>
          <p className="text-gray-600">Verificando sessão...</p>
        </div>
      </div>
    )
  }

  if (!sessionUser) {
    return <Login />
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Configurando sistema</h2>
          <p className="text-gray-600">Preparando banco de dados...</p>
        </div>
      </div>
    )
  }

  // 5) Conteúdo do app (após login + inicialização)
  const renderContent = () => {
    switch (activeTab) {
      case 'inicio':        return <Dashboard />
      case 'profissionais': return <Professionals />
      case 'agenda':        return <Schedule />
      case 'financeiro':    return <Finance />
      case 'relatorios':    return <Reports />
      default:              return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* topo com botão de sair */}
      <header className="flex justify-end p-3">
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm font-medium"
          aria-label="Sair"
        >
          Sair
        </button>
      </header>

      {renderContent()}

      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      />
    </div>
  )
}

export default App
