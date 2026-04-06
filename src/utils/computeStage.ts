/* ============================================
   Авто-расчёт этапа клиента по данным из вкладок
   Читает localStorage и определяет, на каком этапе
   pipeline находится клиент, основываясь на реальном
   прогрессе, а не на ручном переключении.
   ============================================ */

import type { PipelineStage } from '../types';

/**
 * Вычисляет текущий этап клиента на основе заполненности вкладок.
 * Логика: каждый этап считается "пройденным", если соответствующие данные заполнены.
 */
export function computeClientStage(clientId: string): PipelineStage {
  // --- Читаем данные из localStorage ---
  const get = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  // 1. Встреча — всегда пройдена (клиент создан)
  // → meeting ✓

  // 2. Форматы — выбран хотя бы 1 формат публикации
  const formatSlots = get<{ id: number; format: string | null }[]>(`hw_formats_slots_${clientId}`, []);
  const hasFormats = formatSlots.some(s => s.format !== null);
  if (!hasFormats) return 'meeting';

  // 3. Темы — есть хотя бы 1 тема
  const topics = get<{ id: number; title: string; selected: boolean }[]>(`hw_scenarios_topics_${clientId}`, []);
  const hasTopics = topics.length > 0;
  if (!hasTopics) return 'formats';

  // 4. Сценарии — есть сгенерированные скрипты
  const scripts = get<{ id: number; status?: string }[]>(`hw_scenarios_scripts_${clientId}`, []);
  const hasScripts = scripts.length > 0;
  if (!hasScripts) return 'topics';

  // 5. Исходники — хотя бы 1 публикация получила исходник
  const editingItems = get<{ id: number; sourceReceived: boolean; editingDone: boolean; coverDone: boolean; deliveredToClient: boolean }[]>(`hw_editing_${clientId}`, []);
  const hasSourceReceived = editingItems.some(i => i.sourceReceived);
  const hasMovedToShooting = scripts.some(s => s.status === 'shooting' || s.status === 'editing' || s.status === 'published');
  if (!hasSourceReceived && !hasMovedToShooting) return 'scripts';

  // 6. Производство — хотя бы 1 скрипт в статусе "editing" или дальше
  const hasInEditing = scripts.some(s => s.status === 'editing' || s.status === 'published');
  if (!hasInEditing) return 'sources';

  // 7. Готовность — хотя бы 1 единица монтажа отмечена как "editingDone"
  const hasSomethingEdited = editingItems.some(i => i.editingDone);
  if (!hasSomethingEdited) return 'production';

  // 8. Выдача — хотя бы 1 единица монтажа отмечена как "deliveredToClient"
  const hasSomethingDelivered = editingItems.some(i => i.deliveredToClient);
  if (!hasSomethingDelivered) return 'ready';

  // 9. Таргет — хотя бы 1 публикация продвигается
  const targetItems = get<{ id: number; isPromoted: boolean; campaignFinished: boolean }[]>(`hw_targeting_${clientId}`, []);
  const hasTargeting = targetItems.some(t => t.isPromoted);
  if (!hasTargeting) return 'delivered';

  // 10. Фидбек — есть хотя бы 1 отзыв
  const feedback = get<{ id: string; text: string }[]>(`hw_feedback_${clientId}`, []);
  const hasFeedback = feedback.length > 0;
  if (!hasFeedback) return 'targeting';

  // 11. Продление — все публикации выданы и все кампании завершены
  const allDelivered = editingItems.length > 0 && editingItems.every(i => i.deliveredToClient);
  const allCampaignsDone = targetItems.length > 0 && targetItems.filter(t => t.isPromoted).every(t => t.campaignFinished);
  if (allDelivered && allCampaignsDone) return 'retention';

  return 'feedback';
}
