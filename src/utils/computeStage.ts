/* ============================================
   Авто-расчёт этапа клиента по данным из вкладок
   Читает workspace_data (облако) с фоллбеком на localStorage.
   
   Новые этапы (0–11):
   0. new       — ничего не сделали
   1. meeting   — провели встречу
   2. analysis  — сделали анализ Instagram
   3. formats   — выбрали форматы
   4. topics    — утвердили темы
   5. scripts   — сделали сценарии
   6. sources   — ждём исходники
   7. editing   — в монтаже
   8. cover     — обложка
   9. delivered — отдали клиенту
   10. targeting — запустили рекламу
   11. done      — завершено (можно продлить)
   ============================================ */

import type { PipelineStage } from '../types';

/**
 * Вычисляет текущий этап клиента на основе заполненности вкладок.
 */
export function computeClientStage(clientId: string, workspaceData?: Record<string, any>): PipelineStage {
  // --- Универсальный геттер: облако → localStorage → default ---
  const get = <T>(key: string, fallback: T): T => {
    try {
      // 1. Облако (приоритет)
      if (workspaceData && workspaceData[key] !== undefined) {
        const val = workspaceData[key];
        if (val === null) return fallback;
        if (Array.isArray(fallback) && !Array.isArray(val)) return fallback;
        return val as T;
      }
      // 2. localStorage (фоллбек)
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (parsed === null) return fallback;
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed as T;
    } catch {
      return fallback;
    }
  };

  // 0→2: Проверяем анализ Instagram
  // Встреча (этап 1) — ручное действие, не вычисляется автоматически.
  // Если анализ не сделан — рекомендуем 'new' (начальный этап)
  const analysisResult = get<{ aiSummary?: string } | null>(`hw_ai_${clientId}`, null);
  const hasAnalysis = analysisResult && analysisResult.aiSummary;
  if (!hasAnalysis) return 'new';

  // 3. Форматы — выбран хотя бы 1 формат публикации
  const formatSlots = get<{ id: number; format: string | null }[]>(`hw_formats_slots_${clientId}`, []);
  const hasFormats = formatSlots.some(s => s.format !== null);
  if (!hasFormats) return 'analysis';

  // 4. Темы — есть хотя бы 1 тема
  const topics = get<{ id: number; title: string; selected: boolean }[]>(`hw_scenarios_topics_${clientId}`, []);
  const hasTopics = topics.length > 0;
  if (!hasTopics) return 'formats';

  // 5. Сценарии — есть ОДОБРЕННЫЕ скрипты (approved === true)
  const scripts = get<{ id: number; status?: string; approved?: boolean }[]>(`hw_scenarios_scripts_${clientId}`, []);
  const hasApprovedScripts = scripts.some(s => s.approved);
  if (!hasApprovedScripts) return 'topics';

  // 6. Исходники — хотя бы 1 публикация получила исходник
  const editingItems = get<{ id: number; sourceReceived: boolean; editingDone: boolean; coverDone: boolean; deliveredToClient: boolean }[]>(`hw_editing_${clientId}`, []);
  const hasSourceReceived = editingItems.some(i => i.sourceReceived);
  if (!hasSourceReceived) return 'scripts';

  // 7. Монтаж — хотя бы 1 единица смонтирована
  const hasSomethingEdited = editingItems.some(i => i.editingDone);
  if (!hasSomethingEdited) return 'sources';

  // 8. Обложка — хотя бы 1 обложка готова
  const hasCoverDone = editingItems.some(i => i.coverDone);
  if (!hasCoverDone) return 'editing';

  // 9. Выдача — хотя бы 1 выдано клиенту
  const hasSomethingDelivered = editingItems.some(i => i.deliveredToClient);
  if (!hasSomethingDelivered) return 'cover';

  // 10. Реклама — хотя бы 1 публикация продвигается
  const targetItems = get<{ id: number; isPromoted: boolean; campaignFinished: boolean }[]>(`hw_targeting_${clientId}`, []);
  const hasTargeting = targetItems.some(t => t.isPromoted);
  if (!hasTargeting) return 'delivered';

  // 11. Завершено — все выдано и все кампании закончены
  const allDelivered = editingItems.length > 0 && editingItems.every(i => i.deliveredToClient);
  const allCampaignsDone = targetItems.length > 0 && targetItems.filter(t => t.isPromoted).every(t => t.campaignFinished);
  if (allDelivered && allCampaignsDone) return 'done';

  return 'targeting';
}
