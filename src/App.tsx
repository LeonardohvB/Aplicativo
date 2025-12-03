// src/App.tsx
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { ensureProfile } from "./lib/ensureProfile";

import Profile from "./pages/Profile";
import BottomNavigation, { Tab } from "./components/Layout/BottomNavigation";
import Dashboard from "./pages/Dashboard";
import Professionals from "./pages/Professionals";
import Schedule from "./pages/Schedule";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import LoginGate from "./pages/LoginGate";
import OverlayMenu from "./components/common/OverlayMenu";
import PatientsNew from "./pages/PatientsNew";
import PatientEvolution from "./pages/PatientEvolution";
import LiveEncounter from "./pages/LiveEncounter";
import { ConfirmProvider } from "./providers/ConfirmProvider";
import ProfessionalsArchived from "./pages/ProfessionalsArchived";
import { ToastContainer } from "./components/ui/Toast";

// Atestados
import CertificateNew from "./pages/CertificateNew";
import CertificateView from "./pages/CertificateView";

// Registro profissional
import ProfessionalRecord from "./pages/ProfessionalRecord";

// Novo cadastro profissional
import ProfessionalNew from "./pages/ProfessionalNew";

// =======================================================================
// TIPOS
// =======================================================================
type AppTab =
  | Tab
  | "perfil"
  | "patients_new"
  | "evolucao"
  | "certificate_new"
  | "profissionais_arquivados"
  | "registro_profissional"
  | "professional_new"
  | { type: "certificateView"; id: string };

type EncounterData = {
  appointmentId?: string;
  patientName?: string;
  professionalName?: string;
  serviceName?: string;
};

// =======================================================================
// COMPONENTE PRINCIPAL
// =======================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("inicio");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  const onlyFirst = (full?: string | null) => {
    if (!full) return null;
    const p = full.trim().split(/\s+/);
    return p[0] || null;
  };
  const [firstName, setFirstName] = useState<string | null>(null);

  const [certificateInitialData, setCertificateInitialData] = useState<any | null>(null);

  const [liveOpen, setLiveOpen] = useState(false);
  const [encounterData, setEncounterData] = useState<EncounterData | null>(null);

  const [scheduleTs, setScheduleTs] = useState<number>(0);

  // =====================================================================
  // EVENTOS GLOBAIS
  // =====================================================================

  // Prontuário (LiveEncounter) via evento
  useEffect(() => {
    const open = (e: any) => {
      const d = e?.detail || {};
      setEncounterData({
        appointmentId: d.appointmentId,
        patientName: d.patientName,
        professionalName: d.professionalName,
        serviceName: d.serviceName,
      });
      setLiveOpen(true);
    };
    window.addEventListener("encounter:open", open as EventListener);
    return () => window.removeEventListener("encounter:open", open as EventListener);
  }, []);

  useEffect(() => {
    const close = () => setLiveOpen(false);
    window.addEventListener("encounter:close", close as EventListener);
    return () => window.removeEventListener("encounter:close", close as EventListener);
  }, []);

  // Atestado: novo
  useEffect(() => {
    const onCertificateNew = (e: any) => {
      setCertificateInitialData(e?.detail || null);
      setActiveTab("certificate_new");
    };
    window.addEventListener("certificate:new", onCertificateNew as EventListener);
    return () =>
      window.removeEventListener("certificate:new", onCertificateNew as EventListener);
  }, []);

  // Atestado: visualizar já salvo
  useEffect(() => {
    const onCertificateView = (e: any) => {
      const id = e?.detail?.id as string | undefined;
      if (!id) return;
      setActiveTab({ type: "certificateView", id });
    };
    window.addEventListener("certificate:view", onCertificateView as EventListener);
    return () =>
      window.removeEventListener("certificate:view", onCertificateView as EventListener);
  }, []);

  // Novo Paciente
  useEffect(() => {
    const open = () => setActiveTab("patients_new");
    window.addEventListener("patients:new", open as EventListener);
    return () => window.removeEventListener("patients:new", open as EventListener);
  }, []);

  // Novo Profissional
  useEffect(() => {
    const open = () => setActiveTab("professional_new");
    window.addEventListener("professional:new", open as EventListener);
    return () => window.removeEventListener("professional:new", open as EventListener);
  }, []);

  // Abrir relatórios
  useEffect(() => {
    const open = () => setActiveTab("relatorios");
    window.addEventListener("reports:open", open as EventListener);
    return () => window.removeEventListener("reports:open", open as EventListener);
  }, []);

  // Evolução
  useEffect(() => {
    const open = () => setActiveTab("evolucao");
    window.addEventListener("evolution:open", open as EventListener);
    return () => window.removeEventListener("evolution:open", open as EventListener);
  }, []);

  // =====================================================================
  // AUTH / SESSÃO
  // =====================================================================
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) console.warn("getSession error:", error);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          await ensureProfile();
        } catch (_) {}
      }

      setCheckingAuth(false);

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
        setUser(sess?.user ?? null);
        if (sess?.user)
          try {
            await ensureProfile();
          } catch (_) {}
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub();
  }, []);

  // Nome do usuário
  useEffect(() => {
    if (!user) return;
    let canceled = false;

    (async () => {
      const { data: row } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (!canceled) setFirstName(onlyFirst(row?.name ?? null));
    })();

    return () => {
      canceled = true;
    };
  }, [user]);

  useEffect(() => {
    const onSaved = (e: any) => setFirstName(onlyFirst(e?.detail?.name ?? null));
    window.addEventListener("profile:saved", onSaved);
    return () => window.removeEventListener("profile:saved", onSaved);
  }, []);

  // =====================================================================
  // ESTADOS DE CARREGAMENTO / LOGIN
  // =====================================================================
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Carregando…</span>
      </div>
    );
  }

  if (!user) return <LoginGate />;

  const DashboardComp: any = Dashboard;

  const gotoSchedule = (filter: "today" | "week", opts?: { openHistory?: boolean }) => {
    const ts = Date.now();
    setScheduleTs(ts);
    setActiveTab("agenda");
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("agenda:filter", { detail: { range: filter, ts } })
      );
      if (opts?.openHistory) {
        window.dispatchEvent(
          new CustomEvent("agenda:openHistory", { detail: { ts } })
        );
      }
    }, 0);
  };

  // =====================================================================
  // RENDERIZAÇÃO PRINCIPAL (ROTAS INTERNAS)
  // =====================================================================
  const renderContent = () => {
    // 🔹 ROTA-OBJETO: visualizar atestado já salvo
    if (
      typeof activeTab === "object" &&
      activeTab !== null &&
      "type" in activeTab &&
      activeTab.type === "certificateView"
    ) {
      const certId = activeTab.id;
      return (
        <CertificateView
          certificateId={certId}
          onBack={() => setActiveTab("certificate_new")}
        />
      );
    }

    // 🔹 Demais rotas string
    switch (activeTab) {
      case "profissionais":
        return <Professionals />;

      case "professional_new":
        return <ProfessionalNew onBack={() => setActiveTab("profissionais")} />;

      case "profissionais_arquivados":
        return <ProfessionalsArchived onBack={() => setActiveTab("inicio")} />;

      case "agenda":
        return <Schedule key={scheduleTs} />;

      case "financeiro":
        return <Finance />;

      case "relatorios":
        return <Reports />;

      case "patients_new":
        return (
          <PatientsNew
            onBack={() => setActiveTab("inicio")}
            onCreated={() => setActiveTab("inicio")}
          />
        );

      case "evolucao":
        return <PatientEvolution onBack={() => setActiveTab("inicio")} />;

      case "perfil":
        return <Profile onBack={() => setActiveTab("inicio")} />;

      case "certificate_new":
        return (
          <CertificateNew
            onBack={() => setActiveTab("inicio")}
            initialData={certificateInitialData || undefined}
            onCreated={() => setActiveTab("inicio")}
          />
        );

      case "registro_profissional":
        return <ProfessionalRecord onBack={() => setActiveTab("inicio")} />;

      default:
        return (
          <DashboardComp
            firstName={firstName ?? undefined}
            onOpenProfile={() => setActiveTab("perfil")}
            onGotoSchedule={(filter: "today" | "week") =>
              gotoSchedule(filter, { openHistory: filter === "today" })
            }
          />
        );
    }
  };

  // =====================================================================
  // TAB ATIVA DA BOTTOM NAV (sempre um Tab)
  // =====================================================================
  const bottomNavActiveTab: Tab = (() => {
    // Quando for rota-objeto (ex: certificateView) → mantemos "Início"
    if (typeof activeTab === "object") return "inicio";

    // Rotas de tela cheia que devem “acender” apenas o Início
    if (
      activeTab === "perfil" ||
      activeTab === "patients_new" ||
      activeTab === "evolucao" ||
      activeTab === "certificate_new" ||
      activeTab === "profissionais_arquivados" ||
      activeTab === "professional_new" ||
      activeTab === "registro_profissional"
    ) {
      return "inicio";
    }

    // Demais são Tabs normais
    return activeTab as Tab;
  })();

  // =====================================================================
  // RENDER FINAL
  // =====================================================================
  return (
    <ConfirmProvider>
      <div className="app-viewport min-h-screen overflow-y-auto overscroll-contain bg-gray-50 relative">
        {/* MENU FIXO */}
        <div className="fixed right-4 top-4 z-40">
          <OverlayMenu
            onOpenProfile={() => setActiveTab("perfil")}
            onOpenNewPatient={() => setActiveTab("patients_new")}
            onOpenNewProfessional={() => setActiveTab("professional_new")}
            onOpenHistory={() => gotoSchedule("today", { openHistory: true })}
            onOpenCertificateNew={() => setActiveTab("certificate_new")}
            onOpenProfessionalsArchived={() => setActiveTab("profissionais_arquivados")}
            onOpenProfessionalRecord={() => setActiveTab("registro_profissional")}
          />
        </div>

        {renderContent()}

        {/* Bottom Navigation */}
        {!liveOpen && (
          <BottomNavigation
            activeTab={bottomNavActiveTab}
            onTabChange={(t: Tab) => {
              if (t === "agenda") setScheduleTs(Date.now());
              setActiveTab(t);
            }}
          />
        )}

        {/* Live Encounter em tela cheia */}
        {liveOpen && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <LiveEncounter initialData={encounterData || undefined} />
          </div>
        )}
      </div>

      <ToastContainer />
    </ConfirmProvider>
  );
}
