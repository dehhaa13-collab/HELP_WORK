/* ============================================
   ClientWorkspace — Рабочее пространство клиента
   Боковое меню (десктоп) + нижняя навигация (мобайл) + вкладки
   ============================================ */

import { useState, useEffect, lazy, Suspense } from 'react';
import { useClientStore } from '../../store';
import { useClients } from '../../hooks/useClients';
import { PIPELINE_STAGES } from '../../types';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import './ClientWorkspace.css';

// Lazy-loaded tabs — каждая вкладка загружается только при переключении
const DashboardTab = lazy(() => import('../../components/tabs/Dashboard/DashboardTab').then(m => ({ default: m.DashboardTab })));
const AiAnalysisTab = lazy(() => import('../../components/tabs/AiAnalysis/AiAnalysisTab').then(m => ({ default: m.AiAnalysisTab })));
const FormatsTab = lazy(() => import('../../components/tabs/Formats/FormatsTab').then(m => ({ default: m.FormatsTab })));
const ScenariosTab = lazy(() => import('../../components/tabs/Scenarios/ScenariosTab').then(m => ({ default: m.ScenariosTab })));
const EditingTab = lazy(() => import('../../components/tabs/Editing/EditingTab').then(m => ({ default: m.EditingTab })));
const FinanceTab = lazy(() => import('../../components/tabs/Finance/FinanceTab').then(m => ({ default: m.FinanceTab })));
const TargetingTab = lazy(() => import('../../components/tabs/Targeting/TargetingTab').then(m => ({ default: m.TargetingTab })));
const FeedbackTab = lazy(() => import('../../components/tabs/Feedback/FeedbackTab').then(m => ({ default: m.FeedbackTab })));

/** Скелетон-загрузчик вкладки */
function TabLoader() {
  return (
    <div className="tab-loader">
      <div className="tab-loader-bar" />
      <div className="tab-loader-text">Загрузка...</div>
    </div>
  );
}

type TabKey = 'dashboard' | 'ai-analysis' | 'formats' | 'scenarios' | 'editing' | 'finance' | 'targeting' | 'feedback';

interface Tab {
  key: TabKey;
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { key: 'dashboard', label: 'Дашборд', emoji: '🗄️' },
  { key: 'ai-analysis', label: 'AI-анализ', emoji: '🤖' },
  { key: 'formats', label: 'Форматы', emoji: '📱' },
  { key: 'scenarios', label: 'Сценарии', emoji: '📝' },
  { key: 'editing', label: 'Монтаж', emoji: '✂️' },
  { key: 'finance', label: 'Финансы', emoji: '💰' },
  { key: 'targeting', label: 'Таргет', emoji: '📊' },
  { key: 'feedback', label: 'Отзывы', emoji: '💬' },
];

export function ClientWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const { selectedClientId, selectClient } = useClientStore();
  const { data: clients = [], isLoading } = useClients();

  const client = clients.find((c) => c.id === selectedClientId);

  // Only kick back to Dashboard if clients have fully loaded and we genuinely can't find this client
  // (i.e., it was deleted). During loading, clients=[] so we must NOT reset.
  useEffect(() => {
    if (selectedClientId && !client && !isLoading && clients.length >= 0) {
      // Double-check: clients have loaded (isLoading=false) but this ID is missing
      if (clients.length > 0 || !isLoading) {
        selectClient(null);
      }
    }
  }, [selectedClientId, client, selectClient, isLoading, clients.length]);

  if (!client) {
    // Show loading skeleton while data hasn't arrived yet
    if (isLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="magic-skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem' }} />
            <div className="magic-skeleton magic-skeleton-text" style={{ width: 200, margin: '0 auto' }} />
          </div>
        </div>
      );
    }
    return null;
  }

  const stageInfo = PIPELINE_STAGES.find((s) => s.key === client.pipelineStage);
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab clientId={client.id} />;
      case 'ai-analysis':
        return <AiAnalysisTab clientId={client.id} />;
      case 'formats':
        return <FormatsTab clientId={client.id} />;
      case 'scenarios':
        return <ScenariosTab clientId={client.id} />;
      case 'editing':
        return <EditingTab clientId={client.id} />;
      case 'finance':
        return <FinanceTab clientId={client.id} />;
      case 'targeting':
        return <TargetingTab clientId={client.id} />;
      case 'feedback':
        return <FeedbackTab clientId={client.id} />;
      default:
        return <DashboardTab clientId={client.id} />;
    }
  };

  return (
    <div className="workspace">
      {/* Desktop Sidebar */}
      <aside className="workspace-sidebar">
        <div className="sidebar-client-info">
          <button
            className="sidebar-back-btn"
            onClick={() => selectClient(null)}
            title="Назад к дашборду"
          >
            ← Назад
          </button>
          <div className="sidebar-client-avatar">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="sidebar-client-name">{client.name}</h2>
          <span className="sidebar-client-ig">{client.instagram}</span>
          <div className="sidebar-stage-badge">
            {stageInfo?.emoji} {stageInfo?.label} ({stageIndex + 1}/{PIPELINE_STAGES.length})
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`sidebar-nav-item ${activeTab === tab.key ? 'sidebar-nav-item-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="sidebar-nav-emoji">{tab.emoji}</span>
              <span className="sidebar-nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="workspace-main">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button
            className="mobile-back-btn"
            onClick={() => selectClient(null)}
          >
            ←
          </button>
          <div className="mobile-header-info">
            <span className="mobile-header-name">{client.name}</span>
            <span className="mobile-header-stage">{stageInfo?.emoji} {stageInfo?.label}</span>
          </div>
        </div>

        <div className="workspace-tab-header">
          <h2 className="workspace-tab-title">
            {TABS.find((t) => t.key === activeTab)?.emoji}{' '}
            {TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>
        <div className="workspace-tab-content">
          <ErrorBoundary
            key={activeTab}
            section={TABS.find((t) => t.key === activeTab)?.label}
          >
            <Suspense fallback={<TabLoader />}>
              {renderTab()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation (iOS-style tab bar) */}
      <nav className="mobile-bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`mobile-nav-item ${activeTab === tab.key ? 'mobile-nav-item-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="mobile-nav-emoji">{tab.emoji}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
