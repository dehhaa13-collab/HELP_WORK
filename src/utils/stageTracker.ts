/* ============================================
   Stage Tracker — Отслеживание времени на этапе
   CLOUD-SYNCED: Хранит timestamp последней смены
   этапа внутри workspaceData клиента (Supabase).
   Работает одинаково на всех устройствах.
   ============================================ */

import type { PipelineStage } from '../types';

/**
 * Запись о текущем этапе клиента.
 * Хранится в workspaceData под ключом `hw_stage_record_{clientId}`
 * через usePersistedState → автоматически синхронизируется в Supabase.
 */
export interface StageRecord {
  stage: PipelineStage;
  changedAt: string; // ISO date
}

export const DEFAULT_STAGE_RECORD: StageRecord = {
  stage: 'new',
  changedAt: new Date().toISOString(),
};

/**
 * Вычисляет обновлённый StageRecord если этап изменился.
 * Возвращает null если обновление не требуется.
 *
 * Используется в useEffect: если вернулся не null → вызвать setter.
 */
export function getUpdatedStageRecord(
  current: StageRecord,
  newStage: PipelineStage
): StageRecord | null {
  if (current.stage === newStage) return null;

  return {
    stage: newStage,
    changedAt: new Date().toISOString(),
  };
}

/**
 * Возвращает количество дней, прошедших с момента последней смены этапа.
 * Если записи нет — использует fallback дату (createdAt клиента).
 */
export function getDaysOnCurrentStage(record: StageRecord | null, fallbackDate?: string): number {
  const now = new Date();

  if (record && record.changedAt) {
    const changedAt = new Date(record.changedAt);
    const diff = now.getTime() - changedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Fallback: использовать дату создания клиента
  if (fallbackDate) {
    const created = new Date(fallbackDate);
    const diff = now.getTime() - created.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  return 0;
}

/**
 * Определяет уровень "застоя" клиента.
 * 'ok' — нормально (< 4 дней)
 * 'warning' — жёлтый (4–7 дней)
 * 'danger' — красный (8+ дней)
 */
export type IdleLevel = 'ok' | 'warning' | 'danger';

export function getIdleLevel(days: number): IdleLevel {
  if (days >= 8) return 'danger';
  if (days >= 4) return 'warning';
  return 'ok';
}

/**
 * Возвращает человекопонятный текст для подсказки.
 */
export function getIdleHint(days: number): string {
  if (days === 0) return '';
  if (days === 1) return '1 день на этом этапе';
  if (days >= 2 && days <= 4) return `${days} дня на этом этапе`;
  return `${days} дней на этом этапе`;
}
