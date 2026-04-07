/* ============================================
   ActivityLog — Журнал действий (только для админа)
   ============================================ */

import { useState, useEffect, useCallback } from 'react';
import { checkActivityTable, fetchActivityLogs, ACTION_LABELS, SETUP_SQL } from '../../utils/activityLogger';
import './ActivityLog.css';

interface ActivityLogEntry {
  id: string;
  created_at: string;
  user_name: string;
  user_role: string;
  action_type: string;
  client_name: string | null;
  details: string | null;
  metadata: Record<string, any>;
}

export function ActivityLog() {
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [search, setSearch] = useState('');
  const [sqlCopied, setSqlCopied] = useState(false);
  const PAGE_SIZE = 50;

  // Check if table exists on mount
  useEffect(() => {
    checkActivityTable().then(exists => {
      setTableExists(exists);
      if (!exists) setLoading(false);
    });
  }, []);

  // Fetch logs when table exists
  const loadLogs = useCallback(async () => {
    if (!tableExists) return;
    setLoading(true);
    try {
      const result = await fetchActivityLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        actionType: filterAction,
        userName: filterUser,
        search: search.trim(),
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err: any) {
      if (err?.message === 'TABLE_NOT_FOUND') {
        setTableExists(false);
      } else {
        console.error('[ActivityLog] Failed to fetch:', err);
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [tableExists, page, filterAction, filterUser, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!tableExists) return;
    const interval = setInterval(loadLogs, 30_000);
    return () => clearInterval(interval);
  }, [tableExists, loadLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const copySQL = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3000);
    } catch {
      // Fallback: select the text
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин. назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'вчера';
    return `${days} дн. назад`;
  };

  // Get unique users from logs for filter
  const uniqueUsers = [...new Set(logs.map(l => l.user_name))];

  // --- Setup Screen ---
  if (tableExists === false) {
    return (
      <div className="activity-log">
        <div className="activity-setup">
          <div className="activity-setup-icon">📋</div>
          <h2 className="activity-setup-title">Настройка журнала действий</h2>
          <p className="activity-setup-desc">
            Для работы журнала нужно создать таблицу в базе данных. 
            Это делается один раз — скопируйте SQL-запрос и выполните его в Supabase.
          </p>

          <div className="activity-setup-steps">
            <div className="setup-step">
              <span className="setup-step-num">1</span>
              <span>Скопируйте SQL-запрос:</span>
            </div>
            <div className="setup-sql-container">
              <pre className="setup-sql-code">{SETUP_SQL}</pre>
              <button className="btn btn-primary btn-sm setup-copy-btn" onClick={copySQL}>
                {sqlCopied ? '✅ Скопировано!' : '📋 Копировать SQL'}
              </button>
            </div>

            <div className="setup-step">
              <span className="setup-step-num">2</span>
              <span>Откройте SQL Editor в Supabase:</span>
            </div>
            <a
              href="https://supabase.com/dashboard/project/egduscijdjjnxlxphfoe/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary setup-link-btn"
            >
              🔗 Открыть Supabase SQL Editor
            </a>

            <div className="setup-step">
              <span className="setup-step-num">3</span>
              <span>Вставьте SQL и нажмите <b>Run</b></span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={async () => {
              setLoading(true);
              const exists = await checkActivityTable();
              setTableExists(exists);
              setLoading(false);
            }}
            style={{ marginTop: '1.5rem' }}
          >
            🔄 Проверить подключение
          </button>
        </div>
      </div>
    );
  }

  // --- Main Log View ---
  return (
    <div className="activity-log">
      <div className="activity-header">
        <h2 className="activity-title">📋 Журнал действий</h2>
        <div className="activity-stats">
          <span className="activity-stat">{total} записей</span>
          <button className="btn btn-ghost btn-sm" onClick={loadLogs} title="Обновить">
            🔄
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-filters">
        <div className="activity-filter-group">
          <label className="activity-filter-label">Действие:</label>
          <select
            className="activity-filter-select"
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          >
            <option value="all">Все действия</option>
            {Object.entries(ACTION_LABELS).map(([key, { emoji, label }]) => (
              <option key={key} value={key}>{emoji} {label}</option>
            ))}
          </select>
        </div>

        <div className="activity-filter-group">
          <label className="activity-filter-label">Пользователь:</label>
          <select
            className="activity-filter-select"
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
          >
            <option value="all">Все</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="activity-filter-group activity-filter-search">
          <label className="activity-filter-label">Поиск:</label>
          <input
            className="activity-filter-input"
            type="text"
            placeholder="Клиент, действие..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Log Table */}
      {loading ? (
        <div className="activity-loading">
          <div className="magic-skeleton" style={{ height: '40px', marginBottom: '8px' }} />
          <div className="magic-skeleton" style={{ height: '40px', marginBottom: '8px' }} />
          <div className="magic-skeleton" style={{ height: '40px', marginBottom: '8px' }} />
          <div className="magic-skeleton" style={{ height: '40px', marginBottom: '8px' }} />
          <div className="magic-skeleton" style={{ height: '40px' }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="activity-empty">
          <div className="activity-empty-icon">📭</div>
          <p>Пока нет записей в журнале</p>
          <p className="activity-empty-hint">Действия пользователей будут появляться здесь автоматически</p>
        </div>
      ) : (
        <div className="activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th className="activity-th-time">Время</th>
                <th className="activity-th-user">Пользователь</th>
                <th className="activity-th-action">Действие</th>
                <th className="activity-th-client">Клиент</th>
                <th className="activity-th-details">Детали</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const actionInfo = ACTION_LABELS[log.action_type] || { emoji: '❔', label: log.action_type, color: '#94a3b8' };
                return (
                  <tr key={log.id} className="activity-row">
                    <td className="activity-cell-time">
                      <div className="activity-time-main">{formatDate(log.created_at)}</div>
                      <div className="activity-time-ago">{timeAgo(log.created_at)}</div>
                    </td>
                    <td className="activity-cell-user">
                      <span className={`activity-user-badge activity-role-${log.user_role}`}>
                        {log.user_name}
                      </span>
                    </td>
                    <td className="activity-cell-action">
                      <span
                        className="activity-action-badge"
                        style={{ '--action-color': actionInfo.color } as React.CSSProperties}
                      >
                        {actionInfo.emoji} {actionInfo.label}
                      </span>
                    </td>
                    <td className="activity-cell-client">
                      {log.client_name || '—'}
                    </td>
                    <td className="activity-cell-details">
                      {log.details || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="activity-pagination">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Назад
          </button>
          <span className="activity-page-info">
            Стр. {page + 1} из {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
