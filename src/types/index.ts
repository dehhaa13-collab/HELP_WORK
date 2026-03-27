/* ============================================
   Типы данных — Строгая типизация проекта
   ============================================ */

// === Пользователи ===
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'assistant';
}

// === Клиенты ===
export interface Client {
  id: string;
  name: string;
  instagram: string;
  avatar?: string;
  pipelineStage: PipelineStage;
  meetingSummary?: string;
  createdAt: string;
  updatedAt: string;
}

// === Pipeline (11 этапов) ===
export type PipelineStage =
  | 'meeting'        // 1. Встреча
  | 'formats'        // 2. Форматы
  | 'topics'         // 3. Темы
  | 'scripts'        // 4. Сценарии
  | 'sources'        // 5. Исходники
  | 'production'     // 6. Производство
  | 'ready'          // 7. Готовность
  | 'delivered'      // 8. Выдача
  | 'targeting'      // 9. Таргет
  | 'feedback'       // 10. Фидбек
  | 'retention';     // 11. Продление

export const PIPELINE_STAGES: { key: PipelineStage; label: string; emoji: string }[] = [
  { key: 'meeting',    label: 'Встреча',      emoji: '🤝' },
  { key: 'formats',    label: 'Форматы',      emoji: '📱' },
  { key: 'topics',     label: 'Темы',         emoji: '💡' },
  { key: 'scripts',    label: 'Сценарии',     emoji: '📝' },
  { key: 'sources',    label: 'Исходники',    emoji: '📥' },
  { key: 'production', label: 'Производство', emoji: '⚙️' },
  { key: 'ready',      label: 'Готовность',   emoji: '✅' },
  { key: 'delivered',  label: 'Выдача',       emoji: '📤' },
  { key: 'targeting',  label: 'Таргет',       emoji: '🚀' },
  { key: 'feedback',   label: 'Фидбек',      emoji: '💬' },
  { key: 'retention',  label: 'Продление',    emoji: '🔄' },
];

// === Форматы публикаций ===
export type PostFormat = 'reels' | 'post' | 'carousel' | null;

export interface PublicationSlot {
  id: number;
  format: PostFormat;
}

// === AI Анализ (Светофор) ===
export type TrafficLightStatus = 'red' | 'yellow' | 'green' | null;

export interface ProfileAnalysis {
  clientId: string;
  avatar: TrafficLightStatus;
  bio: TrafficLightStatus;
  highlights: TrafficLightStatus;
  feed: TrafficLightStatus;
  aiSummary: string;
  screenshotUrl?: string;
  updatedAt: string;
}

// === Сценарии ===
export interface Topic {
  id: number;
  title: string;
  selected: boolean;
}

export interface Script {
  id: number;
  topicId: number;
  content: string;
}

// === Монтаж ===
export interface EditingItem {
  id: number;
  title: string;
  editingDone: boolean;
  deliveredToClient: boolean;
  coverDone: boolean;
}

// === Таргет ===
export interface TargetingItem {
  id: number;
  publicationTitle: string;
  isPromoted: boolean;
  results: string;
  campaignFinished: boolean;
}

// === Отзывы ===
export interface FeedbackEntry {
  id: string;
  clientId: string;
  text: string;
  createdAt: string;
}

// === Система уведомлений (Toast) ===
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}
