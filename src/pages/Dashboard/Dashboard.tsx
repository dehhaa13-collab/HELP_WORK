import { useState, useEffect, useCallback } from 'react';
import { useAuthStore, useClientStore, useToastStore } from '../../store';
import { useClients, useAddClient, useUpdateClient, useRemoveClient } from '../../hooks/useClients';
import { PIPELINE_STAGES } from '../../types';
import type { Client, PipelineStage } from '../../types';
import './Dashboard.css';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const selectClient = useClientStore((s) => s.selectClient);
  const addToast = useToastStore((s) => s.addToast);

  const { data: clients = [] } = useClients();
  const { mutateAsync: addClient, isPending: isAddingClient } = useAddClient();
  const { mutateAsync: removeClient } = useRemoveClient();
  const { mutateAsync: updateClient } = useUpdateClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstagram, setNewInstagram] = useState('');
  const [newComment, setNewComment] = useState('');

  // Inline editing
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Escape to close modal
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showAddModal) setShowAddModal(false);
      if (editingClientId) setEditingClientId(null);
    }
  }, [showAddModal, editingClientId]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

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
    if (window.confirm(`Удалить клиента "${client.name}"? Это действие необратимо.`)) {
      try {
        await removeClient(client.id);
        addToast('info', 'Клиент удалён', `${client.name} удалён из системы.`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        addToast('error', 'Ошибка удаления', errMsg);
      }
    }
  };

  // === Advance stage (forward) ===
  const handleAdvanceStage = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);
    if (currentIndex >= PIPELINE_STAGES.length - 1) {
      addToast('info', 'Последний этап', `${client.name} уже на финальном этапе «Продление».`);
      return;
    }
    try {
      const nextStage = PIPELINE_STAGES[currentIndex + 1];
      await updateClient({ id: client.id, updates: { pipelineStage: nextStage.key as PipelineStage } });
      addToast('success', 'Этап обновлён', `${client.name} переведён на этап «${nextStage.emoji} ${nextStage.label}».`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка обновления', errMsg);
    }
  };

  // === Go back one stage ===
  const handlePrevStage = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);
    if (currentIndex <= 0) {
      addToast('info', 'Первый этап', `${client.name} уже на начальном этапе «Встреча».`);
      return;
    }
    try {
      const prevStage = PIPELINE_STAGES[currentIndex - 1];
      await updateClient({ id: client.id, updates: { pipelineStage: prevStage.key as PipelineStage } });
      addToast('success', 'Этап обновлён', `${client.name} возвращён на этап «${prevStage.emoji} ${prevStage.label}».`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка обновления', errMsg);
    }
  };

  // === Inline name editing ===
  const startEditName = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditingClientId(client.id);
    setEditName(client.name);
  };

  const saveEditName = async (clientId: string) => {
    if (!editName.trim()) {
      addToast('warning', 'Имя не может быть пустым', 'Введите имя клиента.');
      return;
    }
    try {
      await updateClient({ id: clientId, updates: { name: editName.trim() } });
      addToast('success', 'Имя обновлено', `Имя клиента изменено на «${editName.trim()}».`);
      setEditingClientId(null);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка обновления', errMsg);
    }
  };

  const getStageInfo = (client: Client) => {
    const stage = PIPELINE_STAGES.find((s) => s.key === client.pipelineStage);
    const index = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);
    return { stage, index, total: PIPELINE_STAGES.length };
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
          <span className="dashboard-client-count badge badge-primary">
            {clients.length} {(() => { const n = clients.length % 10; const n100 = clients.length % 100; if (n100 >= 11 && n100 <= 14) return 'клиентов'; if (n === 1) return 'клиент'; if (n >= 2 && n <= 4) return 'клиента'; return 'клиентов'; })()}
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      {/* Pipeline Legend */}
      <div className="pipeline-legend">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage.key} className="pipeline-legend-item">
            <span className="pipeline-legend-number">{i + 1}</span>
            <span className="pipeline-legend-emoji">{stage.emoji}</span>
            <span className="pipeline-legend-label">{stage.label}</span>
          </div>
        ))}
      </div>

      {/* Client Cards */}
      <div className="dashboard-content">
        <div className="dashboard-toolbar">
          <h2 className="dashboard-section-title">Ваши клиенты</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <span>+</span> Добавить клиента
          </button>
        </div>

        {clients.length === 0 ? (
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
            {clients.map((client) => {
              const { stage, index, total } = getStageInfo(client);
              const progress = ((index + 1) / total) * 100;
              const isLastStage = index >= total - 1;
              const isFirstStage = index <= 0;
              const isEditing = editingClientId === client.id;

              return (
                <div
                  key={client.id}
                  className="client-card card"
                  onClick={() => { if (!isEditing) selectClient(client.id); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isEditing) { e.preventDefault(); selectClient(client.id); } }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="client-card-body card-body">
                    {/* Client Info */}
                    <div className="client-card-header">
                      <div className="client-avatar">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="client-info">
                        {isEditing ? (
                          <div className="client-edit-name" onClick={(e) => e.stopPropagation()}>
                            <input
                              className="input client-edit-input"
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEditName(client.id); } if (e.key === 'Escape') setEditingClientId(null); }}
                              autoFocus
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => saveEditName(client.id)}>✓</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingClientId(null)}>✕</button>
                          </div>
                        ) : (
                          <h3
                            className="client-name client-name-editable"
                            onClick={(e) => startEditName(e, client)}
                            title="Нажмите, чтобы изменить имя"
                          >
                            {client.name} <span className="edit-icon">✏️</span>
                          </h3>
                        )}
                        <span className="client-instagram">{client.instagram}</span>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm client-delete"
                        onClick={(e) => { e.stopPropagation(); handleRemoveClient(client); }}
                        title="Удалить клиента"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Comment preview */}
                    {client.meetingSummary && (
                      <div className="client-comment-preview">
                        💬 {client.meetingSummary.length > 60 ? client.meetingSummary.substring(0, 60) + '...' : client.meetingSummary}
                      </div>
                    )}

                    {/* Pipeline Progress */}
                    <div className="client-pipeline">
                      <div className="client-stage">
                        <span className="client-stage-badge badge badge-primary">
                          {stage?.emoji} {stage?.label}
                        </span>
                        <span className="client-stage-counter">
                          Этап {index + 1} из {total}
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

                    {/* Actions — with back/forward stage buttons */}
                    <div className="client-card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); selectClient(client.id); }}
                      >
                        Открыть
                      </button>
                      <div className="stage-nav-buttons">
                        {!isFirstStage && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => handlePrevStage(e, client)}
                            title="Предыдущий этап"
                          >
                            ← Назад
                          </button>
                        )}
                        {!isLastStage && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => handleAdvanceStage(e, client)}
                            title="Следующий этап"
                          >
                            Далее →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
