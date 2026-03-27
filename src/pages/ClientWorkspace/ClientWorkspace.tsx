/* ============================================
   ClientWorkspace — Рабочее пространство клиента
   Боковое меню + вкладки
   ============================================ */

import { useState, useEffect } from 'react';
import { useClientStore } from '../../store';
import { PIPELINE_STAGES } from '../../types';
import { AiAnalysisTab } from '../../components/tabs/AiAnalysis/AiAnalysisTab';
import { FormatsTab } from '../../components/tabs/Formats/FormatsTab';
import { ScenariosTab } from '../../components/tabs/Scenarios/ScenariosTab';
import { EditingTab } from '../../components/tabs/Editing/EditingTab';
import { TargetingTab } from '../../components/tabs/Targeting/TargetingTab';
import { FeedbackTab } from '../../components/tabs/Feedback/FeedbackTab';
import './ClientWorkspace.css';

type TabKey = 'ai-analysis' | 'formats' | 'scenarios' | 'editing' | 'targeting' | 'feedback';

interface Tab {
  key: TabKey;
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { key: 'ai-analysis', label: 'AI-анализ', emoji: '🤖' },
  { key: 'formats', label: 'Форматы', emoji: '📱' },
  { key: 'scenarios', label: 'Сценарии', emoji: '📝' },
  { key: 'editing', label: 'Монтаж', emoji: '✂️' },
  { key: 'targeting', label: 'Таргет', emoji: '📊' },
  { key: 'feedback', label: 'Отзывы', emoji: '💬' },
];

export function ClientWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai-analysis');
  const { clients, selectedClientId, selectClient } = useClientStore();

  const client = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (selectedClientId && !client) {
      selectClient(null);
    }
  }, [selectedClientId, client, selectClient]);

  if (!client) {
    return null;
  }

  const stageInfo = PIPELINE_STAGES.find((s) => s.key === client.pipelineStage);
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);

  const renderTab = () => {
    switch (activeTab) {
      case 'ai-analysis':
        return <AiAnalysisTab clientId={client.id} />;
      case 'formats':
        return <FormatsTab clientId={client.id} />;
      case 'scenarios':
        return <ScenariosTab clientId={client.id} />;
      case 'editing':
        return <EditingTab clientId={client.id} />;
      case 'targeting':
        return <TargetingTab clientId={client.id} />;
      case 'feedback':
        return <FeedbackTab clientId={client.id} />;
      default:
        return <AiAnalysisTab clientId={client.id} />;
    }
  };

  return (
    <div className="workspace">
      {/* Sidebar */}
      <aside className="workspace-sidebar">
        {/* Client Info Header */}
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

        {/* Nav Tabs */}
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
        <div className="workspace-tab-header">
          <h2 className="workspace-tab-title">
            {TABS.find((t) => t.key === activeTab)?.emoji}{' '}
            {TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>
        <div className="workspace-tab-content">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}
