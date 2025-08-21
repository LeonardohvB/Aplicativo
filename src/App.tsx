import React, { useState, useEffect } from 'react';
import { setupDatabase } from './lib/database-setup';
import BottomNavigation from './components/Layout/BottomNavigation';
import Dashboard from './pages/Dashboard';
import Professionals from './pages/Professionals';
import Schedule from './pages/Schedule';
import Finance from './pages/Finance';
import Reports from './pages/Reports';

function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await setupDatabase();
      } catch (error) {
        console.error('Erro na inicialização:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Configurando Sistema</h2>
          <p className="text-gray-600">Preparando banco de dados...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inicio':
        return <Dashboard />;
      case 'profissionais':
        return <Professionals />;
      case 'agenda':
        return <Schedule />;
      case 'financeiro':
        return <Finance />;
      case 'relatorios':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;