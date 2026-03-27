/* ============================================
   App — Главный компонент приложения
   Управляет маршрутизацией: Login -> Dashboard -> Workspace
   ============================================ */

import { useAuthStore, useClientStore } from './store';
import { LoginPage } from './pages/Login/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ClientWorkspace } from './pages/ClientWorkspace/ClientWorkspace';
import { ToastContainer } from './components/Toast/ToastContainer';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedClientId = useClientStore((s) => s.selectedClientId);

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
