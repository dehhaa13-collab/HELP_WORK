import { useState, useEffect } from 'react';
import type { PipelineStage } from '../../types';
import { useAuthStore, useClientStore, useToastStore } from '../../store';
import { useClients, useAddClient, useUpdateClient, useRemoveClient, useUpdateWorkspaceData } from '../../hooks/useClients';
import { PIPELINE_STAGES } from '../../types';
import type { Client } from '../../types';

import { getUpdatedStageRecord, getDaysOnCurrentStage, getIdleLevel, getIdleHint } from '../../utils/stageTracker';
import type { StageRecord } from '../../utils/stageTracker';
import { logActivity } from '../../utils/activityLogger';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { ActivityLog } from './ActivityLog';
import { TaskManager } from './TaskManager';
import './Dashboard.css';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const selectClient = useClientStore((s) => s.selectClient);
  const addToast = useToastStore((s) => s.addToast);

  const { data: clients = [], isLoading, isError } = useClients();
  const { mutateAsync: addClient, isPending: isAddingClient } = useAddClient();
  const { mutateAsync: removeClient } = useRemoveClient();
  const { mutateAsync: updateClient } = useUpdateClient();

  // Счётчик для принудительного пересчёта этапов при возврате на Dashboard
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    // Пересчитываем этапы каждый раз, когда Dashboard получает фокус
    const onFocus = () => forceUpdate(n => n + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstagram, setNewInstagram] = useState('');
  const [newComment, setNewComment] = useState('');
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [dashView, setDashView] = useState<'clients' | 'analytics' | 'activity' | 'tasks'>('clients');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const isAdmin = user?.role === 'admin';

  // Edit modal
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editInstagramUrl, setEditInstagramUrl] = useState('');
  const [editComment, setEditComment] = useState('');


  // Escape to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setEditingClient(null);
        setClientToDelete(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // === Add client (with optional comment) ===
  const handleAddClient = async () => {
    if (!newName.trim()) {
      addToast('warning', 'Введите имя', 'Укажите имя клиента для добавления.');
      return;
    }
    if (!newInstagram.trim()) {
      addToast('warning', 'Введите Instagram', 'Укажите Instagram-аккаунт клиента.');
      return;
    }

    try {
      await addClient({ name: newName.trim(), instagram: newInstagram.trim(), comment: newComment.trim() });
      logActivity({ action_type: 'client_created', client_name: newName.trim(), details: `Instagram: ${newInstagram.trim()}` });
      addToast('success', 'Клиент добавлен', `${newName.trim()} добавлен в систему.`);
      setNewName('');
      setNewInstagram('');
      setNewComment('');
      setShowAddModal(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка добавления', errMsg);
    }
  };

  // === Remove client ===
  const handleRemoveClient = async (client: Client) => {
    setClientToDelete(client);
  };

  const confirmRemoveClient = async () => {
    if (!clientToDelete) return;
    try {
      await removeClient(clientToDelete.id);
      logActivity({ action_type: 'client_deleted', client_name: clientToDelete.name, client_id: clientToDelete.id, details: `Удалён пользователем` });
      addToast('info', 'Клиент удалён', `${clientToDelete.name} удалён из системы.`);
      setClientToDelete(null);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка удаления', errMsg);
    }
  };

  // Этапы теперь вычисляются автоматически из прогресса по вкладкам

  // === Edit client modal ===
  const openEditModal = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditingClient(client);
    setEditName(client.name);
    setEditInstagram(client.instagram);
    setEditInstagramUrl((client.workspaceData?.[`hw_ig_url_${client.id}`] as string) || '');
    setEditComment(client.meetingSummary || '');
  };

  const saveEditClient = async () => {
    if (!editingClient) return;
    if (!editName.trim()) {
      addToast('warning', 'Имя не может быть пустым', 'Введите имя клиента.');
      return;
    }
    if (!editInstagram.trim()) {
      addToast('warning', 'Instagram не может быть пустым', 'Введите Instagram-аккаунт.');
      return;
    }
    try {
      await updateClient({
        id: editingClient.id,
        updates: {
          name: editName.trim(),
          instagram: editInstagram.trim(),
          meetingSummary: editComment.trim(),
        },
      });
      // Save Instagram URL to workspaceData
      const urlKey = `hw_ig_url_${editingClient.id}`;
      await updateWorkspaceData(editingClient.id, urlKey, editInstagramUrl.trim() || null);
      logActivity({ action_type: 'client_name_changed', client_id: editingClient.id, details: `Обновлено: ${editName.trim()} / ${editInstagram.trim()}` });
      addToast('success', 'Клиент обновлён', `Данные «${editName.trim()}» сохранены.`);
      setEditingClient(null);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка обновления', errMsg);
    }
  };



  // === Archive toggle ===
  const updateWorkspaceData = useUpdateWorkspaceData();

  const handleToggleArchived = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const key = `hw_archived_${client.id}`;
    const newVal = !client.workspaceData?.[key];
    updateWorkspaceData(client.id, key, newVal);
  };

  // Track idle time — cloud synced via workspaceData
  useEffect(() => {
    clients.forEach(client => {
      const stageKey = `hw_stage_record_${client.id}`;
      const currentRecord = (client.workspaceData?.[stageKey] as StageRecord | undefined) || null;
      const currentStage = client.pipelineStage || 'new';

      if (!currentRecord) {
        // Первая запись — создаём
        updateWorkspaceData(client.id, stageKey, {
          stage: currentStage,
          changedAt: new Date().toISOString(),
        });
      } else {
        const updated = getUpdatedStageRecord(currentRecord, currentStage);
        if (updated) {
          updateWorkspaceData(client.id, stageKey, updated);
        }
      }
    });
  }, [clients, updateWorkspaceData]);

  // === Manual stage navigation ===
  const handleStageChange = async (e: React.MouseEvent, clientId: string, direction: 'prev' | 'next') => {
    e.stopPropagation();
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === (client.pipelineStage || 'new'));
    const newIndex = direction === 'next'
      ? Math.min(currentIndex + 1, PIPELINE_STAGES.length - 1)
      : Math.max(currentIndex - 1, 0);
    if (newIndex === currentIndex) return;
    const newStage = PIPELINE_STAGES[newIndex].key as PipelineStage;
    try {
      await updateClient({ id: clientId, updates: { pipelineStage: newStage } });
      logActivity({
        action_type: 'stage_changed',
        client_id: clientId,
        client_name: client.name,
        details: `${PIPELINE_STAGES[currentIndex].label} → ${PIPELINE_STAGES[newIndex].label}`,
      });
    } catch { /* toast already handled */ }
  };


  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <span className="dashboard-logo-icon">🎬</span>
          <div>
            <h1 className="dashboard-title">Кабинет продюсера</h1>
            <p className="dashboard-welcome">Добро пожаловать, {user?.name}</p>
          </div>
        </div>
        <div className="dashboard-header-right">
          {/* Временно скрыто по просьбе:
          <span className="dashboard-client-count badge badge-primary">
            {isLoading ? '...' : `${clients.length} ${(() => { const n = clients.length % 10; const n100 = clients.length % 100; if (n100 >= 11 && n100 <= 14) return 'клиентов'; if (n === 1) return 'клиент'; if (n >= 2 && n <= 4) return 'клиента'; return 'клиентов'; })()}`}
          </span>
          */}
          <button className="btn btn-ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      {/* View Switcher */}
      <div className="dash-tab-switcher">
        <button
          className={`dash-tab-btn ${dashView === 'clients' ? 'dash-tab-btn-active' : ''}`}
          onClick={() => setDashView('clients')}
        >
          👥 Клиенты
        </button>
        <button
          className={`dash-tab-btn ${dashView === 'analytics' ? 'dash-tab-btn-active' : ''}`}
          onClick={() => setDashView('analytics')}
        >
          📊 Аналитика
        </button>
        {isAdmin && (
          <button
            className={`dash-tab-btn ${dashView === 'activity' ? 'dash-tab-btn-active' : ''}`}
            onClick={() => setDashView('activity')}
          >
            📋 Журнал
          </button>
        )}
        <button
          className={`dash-tab-btn ${dashView === 'tasks' ? 'dash-tab-btn-active' : ''}`}
          onClick={() => setDashView('tasks')}
        >
          ✅ Задачи
        </button>
      </div>

      {dashView === 'tasks' ? (
        <TaskManager clients={clients} />
      ) : dashView === 'activity' && isAdmin ? (
        <ActivityLog />
      ) : dashView === 'analytics' ? (
        <AnalyticsDashboard clients={clients} />
      ) : (
      <>
      {/* Pipeline Legend — временно скрыто
      <div className="pipeline-legend">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage.key} className="pipeline-legend-item">
            <span className="pipeline-legend-number">{i}</span>
            <span className="pipeline-legend-emoji">{stage.emoji}</span>
            <span className="pipeline-legend-label">{stage.label}</span>
          </div>
        ))}
      </div>
      */}

      {/* Client Cards */}
      <div className="dashboard-content">
        <div className="dashboard-toolbar">
          <div className="dashboard-toolbar-left">
            <h2 className="dashboard-section-title">Ваши клиенты</h2>
            {/* Sort control — visible on desktop inside left area */}
            <div className="sort-control sort-control-desktop">
              <span className="sort-label">Сортировка:</span>
              <select
                className="sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'name')}
                id="client-sort"
              >
                <option value="newest">Новые сверху</option>
                <option value="oldest">Старые сверху</option>
                <option value="name">По имени А–Я</option>
              </select>
            </div>
          </div>
          <div className="dashboard-toolbar-right">
            {/* Archived toggle */}
            {(() => {
              const archivedCount = clients.filter(c => c.workspaceData?.[`hw_archived_${c.id}`]).length;
              if (archivedCount === 0 && !showArchived) return null;
              return (
                <button
                  className={`archived-toggle-btn ${showArchived ? 'archived-toggle-btn-active' : ''}`}
                  onClick={() => setShowArchived(v => !v)}
                  title={showArchived ? 'Вернуться к активным клиентам' : 'Показать завершённых'}
                >
                  {showArchived ? '👁️ К активным' : `🗃️ ${archivedCount} завершён${archivedCount % 10 === 1 && archivedCount % 100 !== 11 ? '' : 'о'}`}
                </button>
              );
            })()}
            {/* Sort on mobile — compact icon button */}
            <div className="sort-control sort-control-mobile">
              <select
                className="sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'name')}
                id="client-sort-mobile"
                aria-label="Сортировка"
              >
                <option value="newest">↓ Новые</option>
                <option value="oldest">↑ Старые</option>
                <option value="name">А–Я</option>
              </select>
            </div>
            {/* Add button — hidden on mobile, replaced by FAB */}
            <button
              className="dashboard-add-btn dashboard-add-btn-desktop"
              onClick={() => setShowAddModal(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Добавить клиента
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="client-grid">
            {[1, 2, 3].map(i => (
               <div key={i} className="client-card card" style={{ height: '300px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                 <div className="magic-skeleton" style={{ width: '60px', height: '60px', borderRadius: '50%', marginBottom: '1rem' }} />
                 <div className="magic-skeleton magic-skeleton-text" style={{ width: '80%', marginBottom: '0.5rem' }} />
                 <div className="magic-skeleton magic-skeleton-text" style={{ width: '50%', marginBottom: '2rem' }} />
                 <div className="magic-skeleton" style={{ width: '100%', height: '8px', borderRadius: '4px', marginTop: 'auto' }} />
               </div>
            ))}
          </div>
        ) : isError ? (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon" style={{ filter: 'grayscale(1)', opacity: 0.5 }}>❗</div>
            <h3>Ошибка загрузки</h3>
            <p>Не удалось получить доступ к базе данных клиентов. Проверьте соединение с интернетом или настройки сети (возможно, ваш бесплатный проект Supabase был поставлен на паузу из-за неактивности, либо заблокирован провайдером/VPN).</p>
            <button className="btn btn-secondary btn-lg" onClick={() => window.location.reload()}>Обновить страницу</button>
          </div>
        ) : clients.length === 0 ? (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">📋</div>
            <h3>Нет клиентов</h3>
            <p>Добавьте первого клиента, чтобы начать работу</p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowAddModal(true)}
            >
              + Добавить клиента
            </button>
          </div>
        ) : (
          <div className="client-grid">
            {[...clients]
              .filter(client => {
                const isArchived = !!client.workspaceData?.[`hw_archived_${client.id}`];
                return showArchived ? isArchived : !isArchived;
              })
              .sort((a, b) => {
                if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                return a.name.localeCompare(b.name, 'ru');
              })
              .map((client) => {
              // Manual stage (user-controlled)
              const manualStageKey = client.pipelineStage || 'new';
              const stage = PIPELINE_STAGES.find(s => s.key === manualStageKey);
              const index = PIPELINE_STAGES.findIndex(s => s.key === manualStageKey);
              const total = PIPELINE_STAGES.length;
              const progress = ((index) / (total - 1)) * 100;
              const isDone = manualStageKey === 'done';
              const isArchived = !!client.workspaceData?.[`hw_archived_${client.id}`];

              // Idle tracking — reads cloud-synced stageRecord from workspaceData
              const stageRecord = (client.workspaceData?.[`hw_stage_record_${client.id}`] as StageRecord | undefined) || null;
              const daysIdle = getDaysOnCurrentStage(stageRecord, client.createdAt);
              const idleLevel = getIdleLevel(daysIdle);
              const idleHint = getIdleHint(daysIdle);

              return (
                <div
                  key={client.id}
                  className={`client-card card ${isArchived ? 'client-card-archived' : ''}`}
                  onClick={() => selectClient(client.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectClient(client.id); } }}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className={`client-idle-corner client-idle-corner-${idleLevel}`}
                    title={idleLevel === 'ok' ? 'Работа идет по плану' : idleHint}
                  />
                  <div className="client-card-body card-body">
                    {/* Client Info */}
                    <div className="client-card-header">
                      <div className="client-avatar">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="client-info">
                        <h3 className="client-name">
                          {client.name}
                          <button
                            className="btn btn-ghost btn-sm edit-icon-btn"
                            onClick={(e) => openEditModal(e, client)}
                            title="Редактировать клиента"
                          >
                            ✏️
                          </button>
                        </h3>
                        <span className="client-instagram">
                          {(() => {
                            const customUrl = client.workspaceData?.[`hw_ig_url_${client.id}`] as string | undefined;
                            const username = client.instagram.replace(/^@/, '');
                            const igUrl = customUrl || (username ? `https://instagram.com/${username}` : '');
                            return igUrl ? (
                              <a
                                href={igUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="client-instagram-link"
                                onClick={(e) => e.stopPropagation()}
                                title="Открыть профиль Instagram"
                              >
                                {client.instagram}
                              </a>
                            ) : client.instagram;
                          })()}
                        </span>
                      </div>
                      <div className="client-card-top-actions" onClick={(e) => e.stopPropagation()}>
                        {/* Archive toggle */}
                        <button
                          className={`btn btn-ghost btn-sm archive-toggle ${isArchived ? 'archive-toggle-active' : ''}`}
                          onClick={(e) => handleToggleArchived(e, client)}
                          title={isArchived ? 'Возобновить работу' : 'Отметить как завершённого'}
                        >
                          <div className={`status-circle ${isArchived ? 'status-circle-inactive' : 'status-circle-active'}`} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm client-delete"
                          onClick={(e) => { e.stopPropagation(); handleRemoveClient(client); }}
                          title="Удалить клиента"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>



                    {/* Pipeline Progress — Manual control */}
                    <div className="client-pipeline">
                      <div className="client-stage">
                        <div className="client-stage-nav">
                          <button
                            className="client-stage-nav-btn"
                            onClick={(e) => handleStageChange(e, client.id, 'prev')}
                            disabled={index === 0}
                            title="Предыдущий этап"
                          >‹</button>
                          <span className="client-stage-badge badge badge-primary">
                            {stage?.emoji} {stage?.label}
                          </span>
                          <button
                            className="client-stage-nav-btn"
                            onClick={(e) => handleStageChange(e, client.id, 'next')}
                            disabled={index === total - 1}
                            title="Следующий этап"
                          >›</button>
                        </div>
                        <span className="client-stage-counter">
                          Этап {index} из {total - 1}
                        </span>
                      </div>
                      <div className="client-progress-bar">
                        <div
                          className="client-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {/* Stage dots */}
                      <div className="client-stage-dots">
                        {PIPELINE_STAGES.map((s, i) => (
                          <div
                            key={s.key}
                            className={`stage-dot ${i <= index ? 'stage-dot-active' : ''} ${i === index ? 'stage-dot-current' : ''}`}
                            title={`${s.emoji} ${s.label}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* AI Recommendation — hidden */}

                    {/* Idle Warning badge removed in favor of corner indicator */}

                    {/* Actions — only show «Продлить» if done; open is done by tapping the card */}
                    {isDone && (
                      <div className="client-card-actions">
                        <button
                          className="btn btn-sm btn-renew"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateClient({ id: client.id, updates: { pipelineStage: 'new' as PipelineStage } });
                              logActivity({
                                action_type: 'stage_changed',
                                client_id: client.id,
                                client_name: client.name,
                                details: 'Продление: цикл начат заново',
                              });
                              addToast('success', 'Цикл продлён', `${client.name} — новый месяц начат!`);
                            } catch { /* toast */ }
                          }}
                        >
                          🔄 Продлить цикл
                        </button>
                      </div>
                    )}

                    {/* Comment preview (Always at bottom) */}
                    <div className="client-comment-preview">
                      💬 {client.meetingSummary ? client.meetingSummary : 'Нет заметок...'}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Empty archived state */}
            {showArchived && clients.filter(c => !!c.workspaceData?.[`hw_archived_${c.id}`]).length === 0 && (
              <div className="dashboard-empty" style={{ gridColumn: '1 / -1' }}>
                <div className="dashboard-empty-icon">🗃️</div>
                <h3>Нет завершённых клиентов</h3>
                <p>Отметьте клиента как завершённого, нажав «○» на его карточке</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile FAB — floating add button */}
      <button
        className="dashboard-fab"
        onClick={() => setShowAddModal(true)}
        aria-label="Добавить клиента"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      </>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); handleAddClient(); } }}>
            <div className="modal-header">
              <h2>Новый клиент</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="login-field">
                <label className="login-label" htmlFor="new-client-name">Имя клиента</label>
                <input
                  id="new-client-name"
                  className="input"
                  type="text"
                  placeholder="Например: Анна Иванова"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="new-client-ig">Instagram</label>
                <input
                  id="new-client-ig"
                  className="input"
                  type="text"
                  placeholder="@username"
                  value={newInstagram}
                  onChange={(e) => setNewInstagram(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="new-client-comment">Комментарий <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(необязательно)</span></label>
                <textarea
                  id="new-client-comment"
                  className="input textarea"
                  placeholder="Заметки после встречи, особенности клиента..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={isAddingClient}>Отмена</button>
              <button className="btn btn-primary" onClick={handleAddClient} disabled={isAddingClient}>
                {isAddingClient ? '...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="modal-overlay" onClick={() => setEditingClient(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); saveEditClient(); } }}>
            <div className="modal-header">
              <h2>Редактировать клиента</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingClient(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="login-field">
                <label className="login-label" htmlFor="edit-client-name">Имя клиента</label>
                <input
                  id="edit-client-name"
                  className="input"
                  type="text"
                  placeholder="Например: Анна Иванова"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="edit-client-ig">Instagram</label>
                <input
                  id="edit-client-ig"
                  className="input"
                  type="text"
                  placeholder="@username"
                  value={editInstagram}
                  onChange={(e) => setEditInstagram(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="edit-client-ig-url">Ссылка на Instagram <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(необязательно)</span></label>
                <input
                  id="edit-client-ig-url"
                  className="input"
                  type="url"
                  placeholder="https://instagram.com/username"
                  value={editInstagramUrl}
                  onChange={(e) => setEditInstagramUrl(e.target.value)}
                />
                <span className="field-hint">Если не указано — сформируется автоматически из @username</span>
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="edit-client-comment">Комментарий <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(необязательно)</span></label>
                <textarea
                  id="edit-client-comment"
                  className="input textarea"
                  placeholder="Заметки после встречи, особенности клиента..."
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingClient(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveEditClient}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {clientToDelete && (
        <div className="modal-overlay" onClick={() => setClientToDelete(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Удалить клиента?</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setClientToDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                Вы действительно хотите навсегда удалить клиента <b>"{clientToDelete.name}"</b>? Это действие необратимо, вся его генерация контента и статус будут потеряны.
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-secondary" onClick={() => setClientToDelete(null)}>Отмена</button>
              <button className="btn btn-danger" onClick={confirmRemoveClient}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
