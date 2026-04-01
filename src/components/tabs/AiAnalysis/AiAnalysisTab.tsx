/* ============================================
   Вкладка 1: AI-анализ Instagram страницы
   Светофор + загрузка скриншота + AI разбор
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
import { fetchGeminiCompletion, extractJsonFromText } from '../../../utils/geminiApi';
import { usePersistedState } from '../../../utils/usePersistedState';
import type { TrafficLightStatus } from '../../../types';
import './AiAnalysisTab.css';

interface Props {
  clientId: string;
}

/* Только результаты анализа → сохраняются в localStorage */
interface AnalysisResult {
  avatar: TrafficLightStatus;
  bio: TrafficLightStatus;
  highlights: TrafficLightStatus;
  feed: TrafficLightStatus;
  aiSummary: string;
}

const statusLabels: Record<string, string> = {
  red: 'Плохо',
  yellow: 'Средне',
  green: 'Отлично',
};

const statusColors: Record<string, string> = {
  red: '#DC2626',
  yellow: '#EAB308',
  green: '#16A34A',
};

export function AiAnalysisTab({ clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);

  /* ── Персистентное состояние: результаты анализа (лёгкие данные) ── */
  const [result, setResult] = usePersistedState<AnalysisResult>(
    `hw_ai_${clientId}`,
    { avatar: null, bio: null, highlights: null, feed: null, aiSummary: '' }
  );

  /* ── Эфемерное состояние: скриншот (тяжёлый base64) и UI-флаги ── */
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Неверный формат', 'Пожалуйста, загрузите изображение (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!screenshotPreview) {
      addToast('warning', 'Загрузите скриншот', 'Сначала загрузите скриншот Instagram-профиля клиента.');
      return;
    }

    setIsAnalyzing(true);

    try {
      const prompt = `Ты — строгий и трендовый SMM-продюсер в бьюти-сфере (тренды 2024-2025 года). Твоя задача — ЖЕСТКО и КРИТИЧНО проанализировать предоставленный скриншот Instagram-профиля мастера. 
Оцени каждый из 4-х элементов: Аватар, Описание (Bio), Хайлайтсы, Визуал ленты (Feed). 

КРИТЕРИИ ОЦЕНКИ (будь строг, "green" даем только за идеальную работу):

1. Аватар (avatar):
- red: Логотип, картинка из интернета, лицо не видно, плохое качество, слишком мелко.
- yellow: Обычное селфи, скучный фон, нет акцента на лицо.
- green: Качественный, светлый профессиональный портрет (лицо крупно), передает эстетику и доверие.

2. Описание / Bio (bio):
- red: Нет четкого УТП, непонятно кто это и откуда, сплошной текст, нет ссылки на запись/прайс.
- yellow: Обычный список услуг (ресницы/брови/ногти), есть город, но нет "изюминки" и призыва к действию.
- green: Инста-лендинг! Четко: кто, в чем суперсила, геолокация, призыв к действию (CTA) и рабочая ссылка на запись.

3. Хайлайтсы (highlights):
- red: Их нет, обложки визуальный мусор или устаревшие шаблоны из 2018 года, названия не читаются.
- yellow: Есть базовые (прайс, отзывы), но обложки выбиваются из общего стиля или оформлены скучно.
- green: Единый визуальный код (минимализм или эстетичные фото обложек), четкая навигация (Прайс, Работы, Обо мне, Как добраться).

4. Визуал ленты / Feed (feed): КРИТИЧЕСКИ ВАЖНО ДЛЯ БЬЮТИ 2025!
- red: Устаревшие шаблоны с текстом, тяжелая "пластиковая" ретушь кожи, бесконечные однотипные макро-глаза/губы, "грязные" цвета, отсутствие мастера в кадре вообще.
- yellow: Аккуратно, но скучно ("натуральная" лента без души). Только работы, нет процесса, нет атмосферы.
- green: Естественность, "живой" контент (slow visuals, reels), текстура кожи без фильтров. Чередование планов: мастер в работе (закулисье), макро-детали, счастливые клиенты. Воздух в кадрах.

Для каждого выбери оценку: "red" (плохо), "yellow" (средне) или "green" (отлично).
Напиши подробный, но жесткий AI-разбор (aiSummary) в формате Markdown, объясняя каждую оценку и давая конкретные советы по улучшению, опираясь на тренды бьюти-сферы (осознанность, аутентичность, отказ от глянца).

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON без текста-обертки в таком формате:
{
  "avatar": "red" | "yellow" | "green",
  "bio": "red" | "yellow" | "green",
  "highlights": "red" | "yellow" | "green",
  "feed": "red" | "yellow" | "green",
  "aiSummary": "Текст разбора..."
}`;

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: screenshotPreview } }
          ]
        }
      ];

      const responseText = await fetchGeminiCompletion(messages);
      
      // Агрессивная экстракция JSON — пробует 4 стратегии парсинга
      const parsed = extractJsonFromText(responseText);

      // Строгая валидация — никаких фейковых данных
      const validStatuses = ['red', 'yellow', 'green'];
      const missingFields: string[] = [];

      if (!validStatuses.includes(parsed.avatar as string)) missingFields.push('avatar');
      if (!validStatuses.includes(parsed.bio as string)) missingFields.push('bio');
      if (!validStatuses.includes(parsed.highlights as string)) missingFields.push('highlights');
      if (!validStatuses.includes(parsed.feed as string)) missingFields.push('feed');
      
      if (missingFields.length > 0) {
        console.error("[AI-анализ] ИИ не дал оценки для:", missingFields, "Ответ:", parsed);
        throw new Error(`ИИ не дал оценки для: ${missingFields.join(', ')}. Попробуйте ещё раз.`);
      }

      if (!parsed.aiSummary || typeof parsed.aiSummary !== 'string' || (parsed.aiSummary as string).trim().length < 10) {
        console.error("[AI-анализ] ИИ не дал текстовый разбор:", parsed);
        throw new Error("ИИ не предоставил текстовый разбор профиля. Попробуйте ещё раз.");
      }

      /* Сохраняем ТОЛЬКО результаты (без скриншота) → гарантированно влезет в localStorage */
      setResult({
        avatar: parsed.avatar as TrafficLightStatus,
        bio: parsed.bio as TrafficLightStatus,
        highlights: parsed.highlights as TrafficLightStatus,
        feed: parsed.feed as TrafficLightStatus,
        aiSummary: parsed.aiSummary as string,
      });
      setIsAnalyzing(false);

      addToast('success', 'Анализ завершён', 'ИИ проанализировал профиль и выставил оценки.');
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка анализа', errMsg);
    }
  };

  const cycleStatus = (field: 'avatar' | 'bio' | 'highlights' | 'feed') => {
    const order: TrafficLightStatus[] = [null, 'red', 'yellow', 'green'];
    const currentIndex = order.indexOf(result[field]);
    const nextIndex = (currentIndex + 1) % order.length;
    setResult((prev) => ({ ...prev, [field]: order[nextIndex] }));
  };

  const renderTrafficLight = (label: string, field: 'avatar' | 'bio' | 'highlights' | 'feed') => {
    const value = result[field];
    return (
      <div className="traffic-light-item" onClick={() => cycleStatus(field)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleStatus(field); } }} role="button" tabIndex={0}>
        <div
          className="traffic-light-indicator"
          style={{
            backgroundColor: value ? statusColors[value] : 'var(--color-border)',
            boxShadow: value ? `0 0 12px ${statusColors[value]}40` : 'none',
          }}
        />
        <div className="traffic-light-info">
          <span className="traffic-light-label">{label}</span>
          <span className="traffic-light-status" style={{ color: value ? statusColors[value] : 'var(--color-text-muted)' }}>
            {value ? statusLabels[value] : 'Не оценено'}
          </span>
        </div>
        <span className="traffic-light-hint">Нажмите для изменения</span>
      </div>
    );
  };

  return (
    <div className="ai-analysis">
      {/* Screenshot Upload */}
      <div className="card ai-upload-card">
        <div className="card-body">
          <h3 className="ai-section-title">📸 Скриншот профиля</h3>
          <p className="ai-section-desc">
            Загрузите скриншот Instagram-страницы клиента для AI-анализа.
          </p>

          {screenshotPreview ? (
            <div className="ai-screenshot-preview">
              <img src={screenshotPreview} alt="Скриншот профиля" />
              <button
                className="btn btn-ghost btn-sm ai-screenshot-remove"
                onClick={() => setScreenshotPreview(null)}
              >
                ✕ Убрать
              </button>
            </div>
          ) : (
            <label className="ai-upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotUpload}
                className="visually-hidden"
              />
              <div className="ai-upload-icon">📁</div>
              <span>Нажмите или перетащите файл</span>
            </label>
          )}

          <button
            className="btn btn-primary btn-lg ai-analyze-btn"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !screenshotPreview}
          >
            {isAnalyzing ? (
              <>
                <span className="login-spinner" /> Анализирую...
              </>
            ) : (
              '🤖 Запустить AI-анализ'
            )}
          </button>
        </div>
      </div>

      {/* Traffic Light */}
      {(result.avatar || result.bio || result.highlights || result.feed) && (
        <div className="card ai-traffic-card">
          <div className="card-body">
            <h3 className="ai-section-title">🚦 Оценка профиля (Светофор)</h3>
            <p className="ai-section-desc">
              AI выставил оценки автоматически. Нажмите на индикатор, чтобы изменить оценку вручную.
            </p>
            <div className="traffic-light-grid">
              {renderTrafficLight('Аватар', 'avatar')}
              {renderTrafficLight('Описание (Bio)', 'bio')}
              {renderTrafficLight('Хайлайтсы', 'highlights')}
              {renderTrafficLight('Визуал ленты', 'feed')}
            </div>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {result.aiSummary && (
        <div className="card ai-summary-card">
          <div className="card-body">
            <h3 className="ai-section-title">📋 Подробный анализ от ИИ</h3>
            <div className="ai-summary-text">
              {result.aiSummary.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
