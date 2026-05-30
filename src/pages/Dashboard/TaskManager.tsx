/* ============================================
   Таск-менеджер
   Задачи с приоритетом, дедлайном, привязкой к клиенту
   ============================================ */

import { useState } from 'react';
import { usePersistedState } from '../../utils/usePersistedState';
import type { Client } from '../../types';
import './TaskManager.css';

interface Task {
  id: number;
  text: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
  deadline: string;       // ISO date string "YYYY-MM-DD" or ""
  clientId: string | null;  // null = общая задача
  createdAt: number;
}

interface Props {
  clients: Client[];
}

const PRIORITY_CONFIG = {
  high:   { label: 'Высокий',  emoji: '🔴', color: 'var(--color-danger)',   bg: 'var(--color-danger-bg)' },
  medium: { label: 'Средний',  emoji: '🟡', color: '#d97706',               bg: 'var(--color-warning-bg)' },
  low:    { label: 'Низкий',   emoji: '🟢', color: 'var(--color-success)',  bg: 'var(--color-success-bg)' },
};

function formatDeadline(iso: string): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!iso) return { text: '', isOverdue: false, isSoon: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 2;
  let text = '';
  if (diff === 0) text = 'Сегодня';
  else if (diff === 1) text = 'Завтра';
  else if (diff === -1) text = 'Вчера';
  else if (isOverdue) text = `${Math.abs(diff)} дн. назад`;
  else text = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return { text, isOverdue, isSoon };
}

export function TaskManager({ clients }: Props) {
  const [tasks, setTasks] = usePersistedState<Task[]>('hw_tasks_v1', []);

  // Form state
  const [newText, setNewText]         = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newDeadline, setNewDeadline] = useState('');
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);

  // Filters
  const [filterClient, setFilterClient] = useState<string | 'all' | 'none'>('all');
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | 'all'>('all');
  const [showDone, setShowDone]           = useState(false);

  const addTask = () => {
    if (!newText.trim()) return;
    const task: Task = {
      id: Date.now(),
      text: newText.trim(),
      done: false,
      priority: newPriority,
      deadline: newDeadline,
      clientId: newClientId,
      createdAt: Date.now(),
    };
    setTasks(prev => [task, ...prev]);
    setNewText('');
    setNewDeadline('');
    setNewClientId(null);
    setNewPriority('medium');
    setShowForm(false);
  };

  const toggleDone = (id: number) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const deleteTask = (id: number) =>
    setTasks(prev => prev.filter(t => t.id !== id));

  const visibleTasks = tasks.filter(t => {
    if (!showDone && t.done) return false;
    if (filterClient === 'none' && t.clientId !== null) return false;
    if (filterClient !== 'all' && filterClient !== 'none' && t.clientId !== filterClient) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  // Sort: not done first, then by priority (high→medium→low), then by deadline
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...visibleTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.createdAt - a.createdAt;
  });

  const doneCount = tasks.filter(t => t.done).length;
  const activeCount = tasks.length - doneCount;
  const overdueCount = tasks.filter(t => !t.done && t.deadline && new Date(t.deadline) < new Date()).length;

  return (
    <div className="task-manager">
      {/* Header */}
      <div className="task-header">
        <div className="task-header-stats">
          <span className="task-stat">
            <span className="task-stat-num">{activeCount}</span>
            <span className="task-stat-label">активных</span>
          </span>
          {overdueCount > 0 && (
            <span className="task-stat task-stat-danger">
              <span className="task-stat-num">{overdueCount}</span>
              <span className="task-stat-label">просрочено</span>
            </span>
          )}
          <span className="task-stat task-stat-done">
            <span className="task-stat-num">{doneCount}</span>
            <span className="task-stat-label">выполнено</span>
          </span>
        </div>
        <button
          className={`task-add-btn ${showForm ? 'cancel' : ''}`}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? (
            <>✕ Отмена</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Новая задача
            </>
          )}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="task-form animate-fade-in">
          <textarea
            className="input textarea task-form-textarea"
            placeholder="Описание задачи..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            rows={2}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTask(); }}
          />
          <div className="task-form-row">
            {/* Priority */}
            <div className="task-form-group">
              <label className="task-form-label">Приоритет</label>
              <div className="task-priority-selector">
                {(['high', 'medium', 'low'] as const).map(p => (
                  <button
                    key={p}
                    className={`task-priority-btn ${newPriority === p ? 'active' : ''}`}
                    style={newPriority === p ? { background: PRIORITY_CONFIG[p].bg, color: PRIORITY_CONFIG[p].color, borderColor: PRIORITY_CONFIG[p].color } : {}}
                    onClick={() => setNewPriority(p)}
                    type="button"
                  >
                    {PRIORITY_CONFIG[p].emoji} {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline */}
            <div className="task-form-group">
              <label className="task-form-label">Дедлайн (необязательно)</label>
              <input
                type="date"
                className="input"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Client */}
            <div className="task-form-group">
              <label className="task-form-label">Клиент (необязательно)</label>
              <select
                className="input"
                value={newClientId ?? ''}
                onChange={e => setNewClientId(e.target.value || null)}
              >
                <option value="">— Общая задача</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={addTask} disabled={!newText.trim()}>
            Добавить задачу
          </button>
          <span className="task-form-hint">⌘+Enter для быстрого добавления</span>
        </div>
      )}

      {/* Filters */}
      <div className="task-filters">
        <div className="task-filter-group">
          <label className="task-filter-label">Клиент</label>
          <select
            className="input task-filter-select"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="all">Все задачи</option>
            <option value="none">Только общие</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="task-filter-group">
          <label className="task-filter-label">Приоритет</label>
          <select
            className="input task-filter-select"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as Task['priority'] | 'all')}
          >
            <option value="all">Все</option>
            <option value="high">🔴 Высокий</option>
            <option value="medium">🟡 Средний</option>
            <option value="low">🟢 Низкий</option>
          </select>
        </div>
        <label className="task-show-done-label">
          <input
            type="checkbox"
            className="magic-checkbox"
            checked={showDone}
            onChange={e => setShowDone(e.target.checked)}
          />
          <span className="task-filter-label">Показать выполненные</span>
        </label>
      </div>

      {/* Task list */}
      {sorted.length === 0 ? (
        <div className="task-empty">
          <div className="task-empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#gradient-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="gradient-success" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <p>{tasks.length === 0 ? 'У вас пока нет задач. Создайте первую!' : 'Нет задач, подходящих под эти фильтры.'}</p>
        </div>
      ) : (
        <div className="task-list">
          {sorted.map(task => {
            const p = PRIORITY_CONFIG[task.priority];
            const dl = formatDeadline(task.deadline);
            const clientName = task.clientId
              ? (clients.find(c => c.id === task.clientId)?.name ?? 'Клиент')
              : null;

            return (
              <div
                key={task.id}
                className={`task-item ${task.done ? 'task-item-done' : ''} ${dl.isOverdue && !task.done ? 'task-item-overdue' : ''}`}
              >
                {/* Priority stripe */}
                <div className="task-priority-stripe" style={{ background: task.done ? 'var(--color-border)' : p.color }} />

                {/* Checkbox */}
                <button
                  className={`task-check-btn ${task.done ? 'task-check-done' : ''}`}
                  onClick={() => toggleDone(task.id)}
                  title={task.done ? 'Отметить как активную' : 'Отметить как выполненную'}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="task-content">
                  <p className="task-text">{task.text}</p>
                  <div className="task-meta">
                    <span className="task-badge" style={{ color: task.done ? 'var(--color-text-muted)' : p.color, background: task.done ? 'var(--color-bg)' : p.bg }}>
                      {p.emoji} {p.label}
                    </span>
                    {clientName && (
                      <span className="task-badge task-client-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        {clientName}
                      </span>
                    )}
                    {dl.text && (
                      <span className={`task-badge task-deadline-badge ${dl.isOverdue && !task.done ? 'overdue' : ''} ${dl.isSoon && !task.done ? 'soon' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {dl.text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  className="task-delete-btn"
                  onClick={() => deleteTask(task.id)}
                  title="Удалить задачу"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
