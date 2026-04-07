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
  workspaceData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// === Pipeline (12 этапов, 0–11) ===
export type PipelineStage =
  | 'new'            // 0. Ничего не сделали
  | 'meeting'        // 1. Провели встречу
  | 'analysis'       // 2. Анализ Instagram
  | 'formats'        // 3. Выбрали форматы
  | 'topics'         // 4. Утвердили темы
  | 'scripts'        // 5. Сделали сценарии
  | 'sources'        // 6. Ждём исходники
  | 'editing'        // 7. В монтаже
  | 'cover'          // 8. Обложка
  | 'delivered'      // 9. Отдали клиенту
  | 'targeting'      // 10. Реклама
  | 'done';          // 11. Завершено (+ продление)

export const PIPELINE_STAGES: { key: PipelineStage; label: string; emoji: string }[] = [
  { key: 'new',       label: 'Новый',         emoji: '⬜' },
  { key: 'meeting',   label: 'Встреча',       emoji: '🤝' },
  { key: 'analysis',  label: 'Анализ',        emoji: '🔍' },
  { key: 'formats',   label: 'Форматы',       emoji: '📱' },
  { key: 'topics',    label: 'Темы',          emoji: '💡' },
  { key: 'scripts',   label: 'Сценарии',      emoji: '📝' },
  { key: 'sources',   label: 'Исходники',     emoji: '📥' },
  { key: 'editing',   label: 'Монтаж',        emoji: '✂️' },
  { key: 'cover',     label: 'Обложка',       emoji: '🎨' },
  { key: 'delivered', label: 'Выдача',        emoji: '📤' },
  { key: 'targeting', label: 'Реклама',       emoji: '🚀' },
  { key: 'done',      label: 'Завершено',     emoji: '✅' },
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
