/* ============================================
   Вкладка 1: AI-анализ Instagram страницы
   Светофор + загрузка скриншота + AI разбор
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
import { fetchGeminiCompletion } from '../../../utils/geminiApi';
import type { TrafficLightStatus } from '../../../types';
import './AiAnalysisTab.css';

interface Props {
  clientId: string;
}

interface AnalysisState {
  avatar: TrafficLightStatus;
  bio: TrafficLightStatus;
  highlights: TrafficLightStatus;
  feed: TrafficLightStatus;
  aiSummary: string;
  screenshotPreview: string | null;
  isAnalyzing: boolean;
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

export function AiAnalysisTab({ clientId: _clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const [state, setState] = useState<AnalysisState>({
    avatar: null,
    bio: null,
    highlights: null,
    feed: null,
    aiSummary: '',
    screenshotPreview: null,
    isAnalyzing: false,
  });

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Неверный формат', 'Пожалуйста, загрузите изображение (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setState((prev) => ({ ...prev, screenshotPreview: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!state.screenshotPreview) {
      addToast('warning', 'Загрузите скриншот', 'Сначала загрузите скриншот Instagram-профиля клиента.');
      return;
    }

    setState((prev) => ({ ...prev, isAnalyzing: true }));

    try {
      const prompt = `Проанализируй предоставленный скриншот Instagram-профиля. 
Оцени каждый из 4-х элементов: Аватар, Описание (Bio), Хайлайтсы, Визуал ленты (Feed). 
Для каждого выбери оценку: "red" (плохо), "yellow" (средне) или "green" (отлично).
Напиши подробный AI-разбор (aiSummary) в формате Markdown, объясняя каждую оценку и давая советы по улучшению. Разбор должен быть на русском языке.

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON (без блочных кавычек \`\`\`, без прочего текста) в таком формате:
{
  "avatar": "red" | "yellow" | "green",
  "bio": "red" | "yellow" | "green",
  "highlights": "red" | "yellow" | "green",
  "feed": "red" | "yellow" | "green",
  "aiSummary": "Текст разбора..."
}`;

      // Using grok-2-vision-1212 for image analysis
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: state.screenshotPreview } }
          ]
        }
      ];

      const responseText = await fetchGeminiCompletion(messages, 'gemini-1.5-flash');
      
      const cleanJson = responseText.replace(/```(json)?/g, '').trim();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (e) {
        console.error("[AI-анализ] Grok вернул не-JSON:", responseText);
        throw new Error("ИИ вернул ответ в неверном формате (не JSON). Проверьте консоль.");
      }

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

      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        avatar: parsed.avatar as TrafficLightStatus,
        bio: parsed.bio as TrafficLightStatus,
        highlights: parsed.highlights as TrafficLightStatus,
        feed: parsed.feed as TrafficLightStatus,
        aiSummary: parsed.aiSummary as string,
      }));

      addToast('success', 'Анализ завершён', 'ИИ проанализировал профиль и выставил оценки.');
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, isAnalyzing: false }));
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка анализа', errMsg);
    }
  };

  const cycleStatus = (field: 'avatar' | 'bio' | 'highlights' | 'feed') => {
    const order: TrafficLightStatus[] = [null, 'red', 'yellow', 'green'];
    const currentIndex = order.indexOf(state[field]);
    const nextIndex = (currentIndex + 1) % order.length;
    setState((prev) => ({ ...prev, [field]: order[nextIndex] }));
  };

  const renderTrafficLight = (label: string, field: 'avatar' | 'bio' | 'highlights' | 'feed') => {
    const value = state[field];
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

          {state.screenshotPreview ? (
            <div className="ai-screenshot-preview">
              <img src={state.screenshotPreview} alt="Скриншот профиля" />
              <button
                className="btn btn-ghost btn-sm ai-screenshot-remove"
                onClick={() => setState((prev) => ({ ...prev, screenshotPreview: null }))}
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
            disabled={state.isAnalyzing || !state.screenshotPreview}
          >
            {state.isAnalyzing ? (
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
      {(state.avatar || state.bio || state.highlights || state.feed) && (
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
      {state.aiSummary && (
        <div className="card ai-summary-card">
          <div className="card-body">
            <h3 className="ai-section-title">📋 Подробный анализ от ИИ</h3>
            <div className="ai-summary-text">
              {state.aiSummary.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
