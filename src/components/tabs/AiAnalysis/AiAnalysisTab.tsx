/* ============================================
   Вкладка 1: AI-анализ Instagram страницы
   Светофор + загрузка скриншота + AI разбор
   ============================================ */

import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useToastStore } from '../../../store';
import { fetchGeminiWithSchema, fetchOpenAIWithSchema } from '../../../utils/geminiApi';
import { usePersistedState } from '../../../utils/usePersistedState';
import { logActivity } from '../../../utils/activityLogger';
import type { TrafficLightStatus } from '../../../types';
// heic2any is imported dynamically only when HEIC files are detected (saves ~1.3MB from initial bundle)
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

  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [aiProvider, setAiProvider] = usePersistedState<'gemini' | 'openai'>(`hw_ai_provider_${clientId}`, 'gemini');

  /**
   * Сжимает изображение через Canvas API.
   * iPhone скриншоты могут весить 5-10МБ → base64 будет 7-14МБ → Vercel Edge лимит 4.5МБ → 500 ошибка.
   * Сжимаем до max 1600px и JPEG quality 0.7 (~200-400КБ) — для ИИ-анализа этого более чем достаточно.
   */
  const compressImage = (dataUrl: string, maxSize = 1600, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Масштабируем, если изображение больше maxSize
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        
        // Логируем для отладки
        const originalKB = Math.round(dataUrl.length * 0.75 / 1024);
        const compressedKB = Math.round(compressed.length * 0.75 / 1024);
        console.info(`[Image] Сжатие: ${originalKB}КБ → ${compressedKB}КБ (${width}×${height}px, quality=${quality})`);
        
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Не удалось декодировать изображение'));
      img.src = dataUrl;
    });
  };

  // Универсальный обработчик файла с поддержкой HEIC
  const processFile = async (file: File) => {
    try {
      setIsProcessingFile(true);
      let finalFile = file;

      // Конвертируем HEIC/HEIF с iPhone (Mac/iOS формат) в стандартный JPEG
      if (
        file.type === 'image/heic' || 
        file.type === 'image/heif' || 
        file.name.toLowerCase().endsWith('.heic')
      ) {
        addToast('info', 'Конвертация', 'Адаптируем формат iPhone (HEIC) для ИИ...');
        // Dynamic import: heic2any (~1.3MB) loads ONLY when needed
        const { default: heic2any } = await import('heic2any');
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8,
        }) as Blob;
        
        finalFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      }

      if (!finalFile.type.startsWith('image/')) {
        addToast('error', 'Неверный формат', 'Пожалуйста, загрузите изображение (PNG, JPG, WebP, HEIC).');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const rawDataUrl = reader.result as string;
        
        // Сжимаем ПЕРЕД отправкой (iPhone фото 5-10МБ → ~300КБ)
        try {
          const compressed = await compressImage(rawDataUrl);
          setScreenshotPreview(compressed);
        } catch {
          // Fallback: используем оригинал, если сжатие не сработало
          setScreenshotPreview(rawDataUrl);
        }
      };
      reader.readAsDataURL(finalFile);
    } catch (error) {
      console.error('Ошибка анализа файла:', error);
      addToast('error', 'Ошибка файла', 'Не удалось прочитать или конвертировать файл.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Paste (Ctrl+V / Cmd+V) handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleAnalyze = async () => {
    if (!screenshotPreview) {
      addToast('warning', 'Загрузите скриншот', 'Сначала загрузите скриншот Instagram-профиля клиента.');
      return;
    }

    setIsAnalyzing(true);
    logActivity({ action_type: 'ai_analysis_started', client_id: clientId, details: 'AI-анализ Instagram запущен' });

    try {
      const prompt = `Ты — высокопрофессиональный и доброжелательный SMM-наставник в бьюти-сфере (тренды 2024-2025 года). Твоя задача — провести структурированный, объективный и поддерживающий аудит предоставленного скриншота Instagram-профиля мастера.
Оцени каждый из 4-х элементов: Аватар, Описание (Bio), Хайлайтсы, Визуал ленты (Feed). 

КРИТЕРИИ ОЦЕНКИ (выставляй оценки честно, но давай рекомендации мягко и конструктивно):

1. Аватар (avatar):
- red: Логотип, картинка из интернета, лицо не видно, плохое качество, слишком мелко.
- yellow: Обычное селфи, скучный фон, нет акцента на лицо.
- green: Качественный, светлый профессиональный портрет (лицо крупно), передает эстетику и доверие.

2. Описание / Bio (bio):
- red: Нет четкого УТП, непонятно кто это и откуда, сплошной текст, нет ссылки на запись/прайс.
- yellow: Обычный список услуг (ресницы/брови/ногти), есть город, но нет "изюминки" и призыва к действию.
- green: Инста-лендинг! Четко: кто, в чем суперсила, геолокация, призыв к действию (CTA) и рабочая ссылка на запись.

3. Хайлайтсы (highlights):
- red: Их нет, обложки визуальный мусор или устаревшие шаблоны, названия не читаются.
- yellow: Есть базовые (прайс, отзывы), но обложки выбиваются из общего стиля или оформлены скучно.
- green: Единый визуальный код (минимализм или эстетичные фото обложек), четкая навигация (Прайс, Работы, Обо мне, Как добраться).

4. Визуал ленты / Feed (feed): КРИТИЧЕСКИ ВАЖНО ДЛЯ БЬЮТИ!
- red: Устаревшие шаблоны с текстом, тяжелая "пластиковая" ретушь кожи, бесконечные однотипные макро-глаза/губы, "грязные" цвета, отсутствие мастера в кадре вообще.
- yellow: Аккуратно, но скучно ("натуральная" лента без души). Только работы, нет процесса, нет атмосферы.
- green: Естественность, "живой" контент (slow visuals, reels), текстура кожи без фильтров. Чередование планов: мастер в работе (закулисье), макро-детали, счастливые клиенты. Воздух в кадрах.

Для каждого выбери оценку: "red" (требует улучшения), "yellow" (хорошо, но можно лучше) или "green" (отлично).
Напиши четкий, понятный и конструктивный AI-разбор (aiSummary) в формате Markdown. Используй дружелюбный, бережный, но профессиональный тон (в стиле 'доброй рекомендации'). Отметь сильные стороны и предложи конкретные шаги, как вариант улучшения каждого элемента, опираясь на тренды (аутентичность, отказ от глянца, "живой" контент). Никакой грубости или надменности.

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

      // Строгая валидация Zod. Внутри fetchGeminiWithSchema работает механизм авто-исправления ошибок.
      const StatusEnum = z.enum(["red", "yellow", "green"]);
      const AiAnalysisSchema = z.object({
        avatar: StatusEnum,
        bio: StatusEnum,
        highlights: StatusEnum,
        feed: StatusEnum,
        aiSummary: z.string().min(10)
      });

      let parsed;
      if (aiProvider === 'openai') {
        parsed = await fetchOpenAIWithSchema(messages, AiAnalysisSchema, 0.1);
      } else {
        parsed = await fetchGeminiWithSchema(messages, AiAnalysisSchema, 0.1);
      }

      /* Сохраняем ТОЛЬКО результаты (без скриншота) → гарантированно влезет в localStorage */
      setResult({
        avatar: parsed.avatar,
        bio: parsed.bio,
        highlights: parsed.highlights,
        feed: parsed.feed,
        aiSummary: parsed.aiSummary,
      });
      setIsAnalyzing(false);

      addToast('success', 'Анализ завершён', 'ИИ проанализировал профиль и выставил оценки.');
      logActivity({ action_type: 'ai_analysis_completed', client_id: clientId, details: 'AI-анализ Instagram завершён успешно' });
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
      
      if (error instanceof z.ZodError) {
        addToast('error', 'Ошибка проверки (Zod)', 'ИИ забыл поставить оценку какому-то элементу. Попробуйте ещё раз.');
      } else {
        const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        addToast('error', 'Ошибка анализа', errMsg);
        logActivity({ action_type: 'ai_analysis_error', client_id: clientId, details: `AI-анализ: ${errMsg}` });
      }
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

          <div className="ai-provider-toggle-wrap">
            <div className="provider-toggle-styled" onClick={() => setAiProvider(prev => prev === 'gemini' ? 'openai' : 'gemini')}>
              <span className={`pt-label pt-free ${aiProvider === 'openai' ? 'dimmed' : ''}`}>
                🟢 Gemini <span>бесплатно</span>
              </span>
              <div className={`pt-switch ${aiProvider === 'openai' ? 'active' : ''}`}>
                <div className="pt-dot"></div>
              </div>
              <span className={`pt-label pt-paid ${aiProvider !== 'openai' ? 'dimmed' : ''}`}>
                ⚡ OpenAI <span>платный</span>
              </span>
            </div>
          </div>

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
            <label 
              className={`ai-upload-area ${isDragActive ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleScreenshotUpload}
                className="visually-hidden"
              />
              <div className="ai-upload-icon">{isProcessingFile ? '⏳' : '📁'}</div>
              <span>
                {isProcessingFile 
                  ? 'Обработка файла...' 
                  : 'Нажмите, перетащите или вставьте картинку (Cmd + V)'}
              </span>
            </label>
          )}

          <button
            className={`btn btn-primary btn-lg ai-analyze-btn ${isAnalyzing ? 'btn-magic' : ''}`}
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

      {/* Traffic Light & Skel */}
      {isAnalyzing && (
          <div className="animate-fade-in">
             <div className="card ai-traffic-card" style={{ marginBottom: "1rem" }}>
               <div className="card-body">
                 <div className="magic-skeleton" style={{ height: "100px", width: "100%" }}></div>
               </div>
             </div>
             <div className="card ai-summary-card">
               <div className="card-body">
                 <div className="magic-skeleton" style={{ height: "160px", width: "100%" }}></div>
               </div>
             </div>
          </div>
      )}

      {!isAnalyzing && (result.avatar || result.bio || result.highlights || result.feed) && (
        <div className="card ai-traffic-card animate-fade-in">
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
      {!isAnalyzing && result.aiSummary && (
        <div className="card ai-summary-card animate-fade-in" style={{ marginTop: "1rem" }}>
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
