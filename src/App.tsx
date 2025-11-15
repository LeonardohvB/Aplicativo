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
import PatientsNew from './pages/PatientsNew'
import PatientEvolution from './pages/PatientEvolution'
import LiveEncounter from './pages/LiveEncounter'
import { ConfirmProvider } from './providers/ConfirmProvider'
import ProfessionalsArchived from './pages/ProfessionalsArchived'
import { ToastContainer } from "./components/ui/Toast";

// === IMPORT ATESTADOS (apenas o que existe) ===
import CertificateNew from './pages/CertificateNew'

// ⭐ NOVO: página de Registro do Profissional
import ProfessionalRecord from './pages/ProfessionalRecord'

// Aceita também “rotas” internas de tela cheia
type AppTab =
  | Tab                       // suas abas da BottomNav
  | 'perfil'
  | 'patients_new'
  | 'evolucao'
  | 'certificate_new'
  | 'profissionais_arquivados'    // ⬅️ rota para arquivados
  | 'registro_profissional'       // ⬅️ NOVA rota: Registro do profissional
  ;

// Dados passados para o prontuário (overlay)
type EncounterData = {
  appointmentId?: string
  patientName?: string
  professionalName?: string
  serviceName?: string
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('inicio')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [user, setUser] = useState<any>(null)

  const onlyFirst = (full?: string | null) => {
    if (!full) return null
    const p = full?.trim().split(/\s+/)
    return p[0] || null
  }
  const [firstName, setFirstName] = useState<string | null>(null)

  // ======= ESTADOS ATESTADOS =======
  const [certificateInitialData, setCertificateInitialData] = useState<any | null>(null)

  // ===== estado do prontuário em overlay =====
  const [liveOpen, setLiveOpen] = useState(false)
  const [encounterData, setEncounterData] = useState<EncounterData | null>(null)

  // 🔹 “carimbo” para forçar remount da Agenda
  const [scheduleTs, setScheduleTs] = useState<number>(0)

  // Abre o prontuário via evento global (fallback/atalhos internos)
  useEffect(() => {
    const open = (e: any) => {
      const d = e?.detail || {}
      setEncounterData({
        appointmentId: d.appointmentId,
        patientName: d.patientName,
        professionalName: d.professionalName,
        serviceName: d.serviceName,
      })
      setLiveOpen(true)
    }
    window.addEventListener('encounter:open', open as EventListener)
    return () => window.removeEventListener('encounter:open', open as EventListener)
  }, [])

  // Fecha o prontuário
  useEffect(() => {
    const close = () => setLiveOpen(false)
    window.addEventListener('encounter:close', close as EventListener)
    return () => window.removeEventListener('encounter:close', close as EventListener)
  }, [])

  // ===== LISTENER ATESTADOS (apenas 'certificate:new' por enquanto) =====
  useEffect(() => {
    const onCertificateNew = (e: any) => {
      setCertificateInitialData(e?.detail || null) // { patientId, professionalId, title, ... }
      setActiveTab('certificate_new')
    }
    window.addEventListener('certificate:new', onCertificateNew as EventListener)
    return () => {
      window.removeEventListener('certificate:new', onCertificateNew as EventListener)
    }
  }, [])

  // Abrir "Novo Paciente" a partir do Dashboard
  useEffect(() => {
    const openPatientsNew = () => setActiveTab('patients_new');
    window.addEventListener('patients:new', openPatientsNew as EventListener);
    return () => window.removeEventListener('patients:new', openPatientsNew as EventListener);
  }, []);

  // Abrir "Relatórios" a partir do Dashboard
  useEffect(() => {
    const openReports = () => setActiveTab('relatorios');
    window.addEventListener('reports:open', openReports as EventListener);
    return () => window.removeEventListener('reports:open', openReports as EventListener);
  }, []);

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

  useEffect(() => {
    const open = () => setActiveTab('evolucao');
    window.addEventListener('evolution:open', open as EventListener);
    return () => window.removeEventListener('evolution:open', open as EventListener);
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

  // 🔹 função única pra ir à Agenda e forçar reload
  const gotoSchedule = (filter: 'today' | 'week', opts?: { openHistory?: boolean }) => {
    const ts = Date.now();
    setScheduleTs(ts);            // muda a key da Agenda → remount
    setActiveTab('agenda');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('agenda:filter', { detail: { range: filter, ts } }));
      if (opts?.openHistory) {
        window.dispatchEvent(new CustomEvent('agenda:openHistory', { detail: { ts } }));
      }
    }, 0);
  };

  // ===== conteúdo por aba / rota interna =====
  const renderContent = () => {
    switch (activeTab) {
      case 'profissionais':
        return <Professionals />
      case 'profissionais_arquivados':
        return (
          <ProfessionalsArchived onBack={() => setActiveTab('inicio')} />
        )
      case 'agenda':
        return <Schedule key={scheduleTs} />
      case 'financeiro':
        return <Finance />
      case 'relatorios':
        return <Reports />
      case 'patients_new':
        return (
          <PatientsNew
            onBack={() => setActiveTab('agenda')}
            onCreated={() => setActiveTab('agenda')}
          />
        )
      case 'evolucao':
        return <PatientEvolution onBack={() => setActiveTab('agenda')} />
      case 'perfil':
        return <Profile onBack={() => setActiveTab('inicio')} />
      case 'certificate_new':
        return (
          <CertificateNew
            onBack={() => setActiveTab('inicio')}
            initialData={certificateInitialData || undefined}
            onCreated={(_id) => setActiveTab('inicio')}
          />
        )
      case 'registro_profissional':        // ⭐ NOVO: Registro do profissional
        // 👇 AQUI adicionamos o onBack para funcionar igual Perfil/Atestados
        return <ProfessionalRecord onBack={() => setActiveTab('inicio')} />
      default:
        return (
          <DashboardComp
            firstName={firstName ?? undefined}
            onOpenProfile={() => setActiveTab('perfil')}
            onGotoSchedule={(filter: 'today' | 'week') => {
              gotoSchedule(filter, { openHistory: filter === 'today' })
            }}
          />
        )
    }
  }

  // ===== retorno =====
  return (
    <ConfirmProvider>
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
            onOpenHistory={() => {
              gotoSchedule('today', { openHistory: true });
            }}
            onOpenCertificateNew={() => setActiveTab('certificate_new')}
            // lista de arquivados pelo menu suspenso
            onOpenProfessionalsArchived={() => setActiveTab('profissionais_arquivados')}
            onOpenProfessionalRecord={() => setActiveTab('registro_profissional')}
          />
        </div>

        {renderContent()}

        {/* Esconde a BottomNavigation quando o prontuário estiver aberto */}
        {!liveOpen && (
          <BottomNavigation
            activeTab={
              activeTab === 'perfil' ||
              activeTab === 'patients_new' ||
              activeTab === 'evolucao' ||
              activeTab === 'certificate_new' ||
              activeTab === 'profissionais_arquivados' ||
              activeTab === 'registro_profissional'
                ? 'inicio'
                : (activeTab as Tab)
            }
            onTabChange={(t: Tab) => {
              if (t === 'agenda') setScheduleTs(Date.now());
              setActiveTab(t);
            }}
          />
        )}

        {/* Overlay do LiveEncounter em tela cheia */}
        {liveOpen && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <LiveEncounter initialData={encounterData || undefined} />
          </div>
        )}
      </div>
      <ToastContainer />
    </ConfirmProvider>
  )
}
