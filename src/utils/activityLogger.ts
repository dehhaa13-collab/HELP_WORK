/* ============================================
   Activity Logger — Журнал действий пользователей
   Логирует все ключевые действия в Supabase.
   Никогда не крашит приложение (fire-and-forget).
   ============================================ */

import { supabase } from './supabase';
import { useAuthStore } from '../store';

export type ActionType =
  | 'login'
  | 'logout'
  | 'client_created'
  | 'client_deleted'
  | 'client_name_changed'
  | 'stage_changed'
  | 'stage_recommendation_accepted'
  | 'ai_analysis_started'
  | 'ai_analysis_completed'
  | 'ai_analysis_error'
  | 'script_generated'
  | 'script_approved'
  | 'script_status_changed'
  | 'editing_source_received'
  | 'editing_done'
  | 'editing_delivered'
  | 'feedback_added'
  | 'error';

interface LogEntry {
  action_type: ActionType;
  client_name?: string;
  client_id?: string;
  details?: string;
  metadata?: Record<string, any>;
}

// Track whether the table exists to avoid repeated 404s
let tableAvailable: boolean | null = null; // null = unknown
let lastCheckTime = 0;
const RECHECK_INTERVAL_MS = 60_000; // Retry every 60s if table was unavailable

/**
 * Log an activity. Fire-and-forget — never throws, never blocks UI.
 */
export function logActivity(entry: LogEntry): void {
  // Skip if we know the table doesn't exist — but retry periodically
  if (tableAvailable === false) {
    if (Date.now() - lastCheckTime < RECHECK_INTERVAL_MS) return;
    // Reset to unknown to allow retry
    tableAvailable = null;
  }

  const user = useAuthStore.getState().user;

  // Run async without awaiting
  (async () => {
    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_name: user?.name || 'Система',
        user_role: user?.role || 'system',
        action_type: entry.action_type,
        client_name: entry.client_name || null,
        client_id: entry.client_id || null,
        details: entry.details || null,
        metadata: entry.metadata || {},
      });

      if (error) {
        // Table doesn't exist — stop trying (PGRST205 = table not in schema cache)
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('Could not find') || error.message?.includes('relation')) {
          tableAvailable = false;
          lastCheckTime = Date.now();
        }
      } else {
        tableAvailable = true;
      }
    } catch {
      // Never crash the app for logging
    }
  })();
}

/**
 * Check if the activity_logs table exists. Used by the admin page.
 */
export async function checkActivityTable(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // PostgREST returns PGRST205 for tables not in schema cache
      const msg = error.message || '';
      const code = error.code || '';
      if (code === 'PGRST205' || code === '42P01' || msg.includes('Could not find') || msg.includes('relation') || msg.includes('does not exist')) {
        tableAvailable = false;
        return false;
      }
      // Could be RLS or other error — table likely exists
      tableAvailable = true;
      return true;
    }

    tableAvailable = true;
    return true;
  } catch {
    tableAvailable = false;
    return false;
  }
}

/**
 * Fetch activity logs with pagination.
 */
export async function fetchActivityLogs(options: {
  limit?: number;
  offset?: number;
  actionType?: string;
  userName?: string;
  search?: string;
} = {}) {
  const { limit = 100, offset = 0, actionType, userName, search } = options;

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType && actionType !== 'all') {
    query = query.eq('action_type', actionType);
  }
  if (userName && userName !== 'all') {
    query = query.eq('user_name', userName);
  }
  if (search) {
    query = query.or(`details.ilike.%${search}%,client_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    const msg = error.message || '';
    const code = error.code || '';
    if (code === 'PGRST205' || code === '42P01' || msg.includes('Could not find') || msg.includes('does not exist')) {
      tableAvailable = false;
      throw new Error('TABLE_NOT_FOUND');
    }
    throw error;
  }
  return { logs: data || [], total: count || 0 };
}

// === Setup SQL for creating the table ===
export const SETUP_SQL = `-- Создание таблицы журнала действий
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  client_name text,
  client_id uuid,
  details text,
  metadata jsonb DEFAULT '{}'
);

-- Доступ для anon роли
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON activity_logs
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type
  ON activity_logs(action_type);`;

// Human-readable labels for action types
export const ACTION_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  login:                        { emoji: '🔑', label: 'Вход в систему',       color: '#6366f1' },
  logout:                       { emoji: '🚪', label: 'Выход',               color: '#64748b' },
  client_created:               { emoji: '➕', label: 'Клиент создан',       color: '#22c55e' },
  client_deleted:               { emoji: '🗑️', label: 'Клиент удалён',       color: '#ef4444' },
  client_name_changed:          { emoji: '✏️', label: 'Имя изменено',        color: '#f59e0b' },
  stage_changed:                { emoji: '▶️', label: 'Этап изменён',        color: '#3b82f6' },
  stage_recommendation_accepted:{ emoji: '💡', label: 'Рекомендация принята', color: '#f59e0b' },
  ai_analysis_started:          { emoji: '🤖', label: 'AI-анализ запущен',   color: '#8b5cf6' },
  ai_analysis_completed:        { emoji: '✅', label: 'AI-анализ готов',     color: '#22c55e' },
  ai_analysis_error:            { emoji: '❌', label: 'Ошибка AI-анализа',   color: '#ef4444' },
  script_generated:             { emoji: '📝', label: 'Сценарий создан',     color: '#8b5cf6' },
  script_approved:              { emoji: '✅', label: 'Сценарий одобрен',    color: '#22c55e' },
  script_status_changed:        { emoji: '🔄', label: 'Статус сценария',     color: '#3b82f6' },
  editing_source_received:      { emoji: '📦', label: 'Исходник получен',    color: '#06b6d4' },
  editing_done:                 { emoji: '🎬', label: 'Монтаж завершён',     color: '#22c55e' },
  editing_delivered:            { emoji: '📤', label: 'Выдано клиенту',      color: '#10b981' },
  feedback_added:               { emoji: '💬', label: 'Отзыв добавлен',      color: '#f59e0b' },
  error:                        { emoji: '⚠️', label: 'Ошибка',             color: '#ef4444' },
};
