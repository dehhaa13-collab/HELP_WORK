/* ============================================
   Stage Tracker — Отслеживание времени на этапе
   Хранит timestamp последней смены этапа для каждого
   клиента и вычисляет "застой" (idle days).
   ============================================ */

import type { PipelineStage } from '../types';

interface StageRecord {
  stage: PipelineStage;
  changedAt: string; // ISO date
}

const STORAGE_PREFIX = 'hw_stage_record_';

/**
 * Обновляет запись об этапе клиента.
 * Если этап изменился — обновляет timestamp.
 * Если этап тот же — ничего не делает.
 * Если записи нет — создаёт с текущей датой.
 */
export function trackStageChange(clientId: string, currentStage: PipelineStage): void {
  const key = `${STORAGE_PREFIX}${clientId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const record: StageRecord = JSON.parse(raw);
      if (record.stage !== currentStage) {
        // Этап изменился — обновляем время
        const newRecord: StageRecord = {
          stage: currentStage,
          changedAt: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(newRecord));
      }
      // Если этап тот же — не трогаем timestamp
    } else {
      // Первая запись — создаём с текущей датой
      const newRecord: StageRecord = {
        stage: currentStage,
        changedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(newRecord));
    }
  } catch {
    // Fallback: создаём новую запись
    const newRecord: StageRecord = {
      stage: currentStage,
      changedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(newRecord));
  }
}

/**
 * Возвращает количество дней, прошедших с момента последней смены этапа.
 * Если записи нет — использует fallback дату (createdAt клиента).
 */
export function getDaysOnCurrentStage(clientId: string, fallbackDate?: string): number {
  const key = `${STORAGE_PREFIX}${clientId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const record: StageRecord = JSON.parse(raw);
      const changedAt = new Date(record.changedAt);
      const now = new Date();
      const diff = now.getTime() - changedAt.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
  } catch {
    // ignore
  }

  // Fallback: использовать дату создания клиента
  if (fallbackDate) {
    const created = new Date(fallbackDate);
    const now = new Date();
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
