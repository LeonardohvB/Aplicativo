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
import Login from './pages/Login'

// 👇 Tipo mais amplo: inclui as abas do BottomNav + 'perfil'
type AppTab = Tab | 'perfil'




export default function App() {
  // 👇 agora o estado aceita 'perfil'
  const [activeTab, setActiveTab] = useState<AppTab>('inicio')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [user, setUser] = useState<any>(null)
  const onlyFirst = (full?: string | null) => {
  if (!full) return null;
  const p = full.trim().split(/\s+/);
  return p[0] || null;
};
  const [firstName, setFirstName] = useState<string | null>(null);

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

     useEffect(() => {
  if (!user) return;

  let canceled = false;
  (async () => {
    const { data: row, error } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (!canceled) {
      if (error) console.warn('fetch profile name error:', error);
      setFirstName(onlyFirst(row?.name ?? null));
    }
  })();

  return () => { canceled = true; };
}, [user]);

useEffect(() => {
  const onSaved = (e: any) => setFirstName(onlyFirst(e?.detail?.name ?? null));
  window.addEventListener('profile:saved', onSaved);
  return () => window.removeEventListener('profile:saved', onSaved);
}, []);

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
      case 'perfil':        return <Profile onBack={() => setActiveTab('inicio')} />
      default:              return <Dashboard firstName={firstName ?? undefined} onOpenProfile={() => setActiveTab('perfil')} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}

      {/* 
        BottomNavigation só conhece Tabs “normais”.
        - Se estiver em 'perfil', mostramos como 'inicio' para não quebrar tipagem.
        - onTabChange continua recebendo Tab e definimos no estado (AppTab) sem erro.
      */}
      <BottomNavigation
        activeTab={activeTab === 'perfil' ? 'inicio' : (activeTab as Tab)}
        onTabChange={(t: Tab) => setActiveTab(t)}
      />
    </div>
  )
}
