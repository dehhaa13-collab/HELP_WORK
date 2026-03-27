/* ============================================
   App — Главный компонент приложения
   Управляет маршрутизацией: Login -> Dashboard -> Workspace
   ============================================ */

import { useEffect } from 'react';
import { useAuthStore, useClientStore } from './store';
import { LoginPage } from './pages/Login/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ClientWorkspace } from './pages/ClientWorkspace/ClientWorkspace';
import { ToastContainer } from './components/Toast/ToastContainer';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedClientId = useClientStore((s) => s.selectedClientId);
  const fetchClients = useClientStore((s) => s.fetchClients);
  const initRealtime = useClientStore((s) => s.initRealtime);

  // Загрузить клиентов из Supabase и включить realtime синхронизацию
  useEffect(() => {
    fetchClients();
    initRealtime();
  }, [fetchClients, initRealtime]);

  return (
    <>
      {!isAuthenticated ? (
        <LoginPage />
      ) : selectedClientId ? (
        <ClientWorkspace />
      ) : (
        <Dashboard />
      )}
      <ToastContainer />
    </>
  );
}

export default App;
