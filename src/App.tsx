// src/App.tsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ensureProfile } from './lib/ensureProfile'

import BottomNavigation, { Tab } from './components/Layout/BottomNavigation'
import Dashboard from './pages/Dashboard'
import Professionals from './pages/Professionals'
import Schedule from './pages/Schedule'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Login from './pages/Login'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let unsub = () => {}

    ;(async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) console.warn('getSession error:', error)
      setUser(session?.user ?? null)

      // ✅ blindado: não trava a UI se der erro
      if (session?.user) {
        try {
          await ensureProfile()
        } catch (e) {
          console.warn('ensureProfile(getSession) error:', e)
        }
      }

      setCheckingAuth(false)

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
        setUser(sess?.user ?? null)
        if (sess?.user) {
          try {
            await ensureProfile()
          } catch (e) {
            console.warn('ensureProfile(onAuth) error:', e)
          }
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })()

    return () => unsub()
  }, [])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Carregando…</span>
      </div>
    )
  }

  if (!user) return <Login />

  const renderContent = () => {
    switch (activeTab) {
      case 'profissionais': return <Professionals />
      case 'agenda':        return <Schedule />
      case 'financeiro':    return <Finance />
      case 'relatorios':    return <Reports />
      default:              return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
