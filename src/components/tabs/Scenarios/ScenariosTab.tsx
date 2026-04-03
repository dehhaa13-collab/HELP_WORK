/* ============================================
   Фабрика Контента (Scenarios Tab)
   Свободный вертикальный скролл с независимыми блоками
   ============================================ */

import { z } from 'zod';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../../../store';
import { fetchGeminiCompletion, fetchGeminiWithSchema } from '../../../utils/geminiApi';
import { usePersistedState } from '../../../utils/usePersistedState';
import './ScenariosTab.css';

interface Props {
  clientId: string;
}

// === Zod Schemas for Runtime Safety ===
const TopicSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1)
});

const TopicsArraySchema = z.array(TopicSchema);

const ScriptSchema = z.object({
  topicTitle: z.string().optional(),
  hook: z.string().optional(),
  visuals: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  music: z.string().optional(),
  duration: z.string().optional()
});

const ScriptsArraySchema = z.array(ScriptSchema);

interface TopicItem {
  id: number;
  title: string;
  selected: boolean;
}

export type ScriptStatus = 'idea' | 'script' | 'shooting' | 'editing' | 'published';

interface ScriptItem {
  id: number;
  topicTitle: string;
  status?: ScriptStatus; // Управление через Kanban
  content?: string; // Legacy support
  hook?: string;
  visuals?: string;
  body?: string;
  cta?: string;
  music?: string;
  duration?: string;
}

export function ScenariosTab({ clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);

  // --- Persistent States ---
  const [clientNiche, setClientNiche] = usePersistedState(`hw_client_niche_${clientId}`, '');
  const [competitors, setCompetitors] = usePersistedState(`hw_competitors_ai_${clientId}`, '');
  const [topics, setTopics] = usePersistedState<TopicItem[]>(`hw_scenarios_topics_${clientId}`, []);
  const [scripts, setScripts] = usePersistedState<ScriptItem[]>(`hw_scenarios_scripts_${clientId}`, []);
  
  // AI Options
  const [aiTone, setAiTone] = usePersistedState(`hw_ai_tone_${clientId}`, 'expert');
  const [aiFormat, setAiFormat] = usePersistedState(`hw_ai_format_${clientId}`, 'talking_head');

  // --- Loading States ---
  const [isGeneratingCompetitors, setIsGeneratingCompetitors] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);

  // --- 1. Анализ Конкурентов (Интернет-поиск) ---
  const handleAICompetitors = async () => {
    if (!clientNiche.trim() && !competitors.trim()) {
      addToast('warning', 'Пустые поля', 'Введите нишу или никнеймы конкурентов.');
      return;
    }
    setIsGeneratingCompetitors(true);
    try {
      const isCustomSearch = competitors.trim().length > 0;
      const prompt = isCustomSearch 
        ? `Проанализируй конкретных Insta-конкурентов: "${competitors}".
СХОДИ В ИНТЕРНЕТ (Google Search) и найди их страницы, статьи о них или их последние вирусные форматы.
Выдели их лучшие хуки, форматы видео и стиль. Напиши выжимку их сильных сторон.`
        : `Ниша: "${clientNiche}".
СХОДИ В ИНТЕРНЕТ (Google Search) и найди актуальные тренды Reels в этой нише на текущий месяц.
Опиши 2-3 топовых конкурентов. Какие именно форматы и тексты (хуки) они сейчас используют?`;

      const responseText = await fetchGeminiCompletion(
        [{ role: 'user', content: prompt }], 
        0.3, 
        'gemini-2.5-flash',
        'text/plain',
        undefined,
        true // Включаем Глубокий Поиск
      );
      
      setCompetitors(responseText.trim());
      addToast('success', 'Анализ завершен', 'ИИ просканировал тренды в сети.');
    } catch (error: any) {
      console.error(error);
      addToast('error', 'Ошибка поиска', error?.message || 'Не удалось связаться с поисковиком.');
    } finally {
      setIsGeneratingCompetitors(false);
    }
  };

  // --- 2. Генерация Тем ---
  const handleGenerateTopics = async () => {
    if (!clientNiche.trim()) {
      addToast('warning', 'Пустая ниша', 'Кратко опишите клиента перед генерацией.');
      return;
    }
    setIsGeneratingTopics(true);
    try {
      const prompt = `Ниша клиента: "${clientNiche}".
${competitors ? 'Анализ трендов и конкурентов:\n' + competitors : ''}

Предложи 15 вирусных, кликабельных тем для Reels для этого профиля.
ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ С ОБЪЕКТАМИ:
[
  { "id": 1, "title": "Название темы 1" },
  { "id": 2, "title": "Название темы 2" }
]`;

      const generatedTopics = await fetchGeminiWithSchema(
        [
          { 
            role: 'system', 
            content: `Ты элитный Instagram-маркетолог. Твоя задача — придумывать названия для Reels.
ПРИМЕРЫ ХОРОШИХ НАЗВАНИЙ (как эталон стиля):
1. "Чому у вас випадає волосся, навіть якщо догляд дорогий"
2. "3 помилки, які посилюють випадіння волосся"
3. "Коли ще не пізно зупинити випадіння: тест"
Пиши на языке, указанном в нише клиента. Выдаешь строго JSON-массив.`
          },
          { role: 'user', content: prompt }
        ],
        TopicsArraySchema,
        0.7
      );

      const formatted = generatedTopics.slice(0, 15).map((t, i) => ({
        id: Date.now() + i,
        title: t.title,
        selected: false
      }));

      setTopics(formatted);
      addToast('success', 'Темы готовы', `ИИ сгенерировал ${formatted.length} тем.`);
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
         addToast('error', 'Ошибка структуры ИИ', 'ИИ выдал некорректный ответ (не прошел валидацию Zod). Попробуйте еще раз.');
      } else {
         addToast('error', 'Ошибка генерации', 'ИИ вернул неверный формат.');
      }
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const handleAddCustomTopic = () => {
    const newTopic: TopicItem = { id: Date.now(), title: 'Новая своя тема...', selected: true };
    setTopics([...topics, newTopic]);
  };

  const toggleTopic = (id: number) => {
    setTopics(topics.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const updateTopicTitle = (id: number, newTitle: string) => {
    setTopics(topics.map(t => t.id === id ? { ...t, title: newTitle } : t));
  };

  const removeTopic = (id: number) => {
    setTopics(topics.filter(t => t.id !== id));
  };

  // --- 3. Генерация Сценариев ---
  const handleGenerateScripts = async (specificTopicId?: number) => {
    // Если передан конкретный ID, генерируем только для него
    const topicsToProcess = specificTopicId 
      ? topics.filter(t => t.id === specificTopicId)
      : topics.filter(t => t.selected);

    if (topicsToProcess.length === 0) {
      addToast('warning', 'Выберите темы', 'Сначала отметьте галочками темы для сценариев.');
      return;
    }

    setIsGeneratingScripts(true);
    try {
      const selectedTitles = topicsToProcess.map(t => t.title).join(';\n');
      
      const toneMap: Record<string, string> = {
        'expert': 'Строго профессионально, экспертно, с фактами.',
        'simple': 'Простая разговорная форма, дружелюбно, как с другом.',
        'humorous': 'С юмором, шутками, возможно сарказмом.',
        'provocative': 'Дерзко, вызывающе, через ломку стереотипов.'
      };
      
      const formatMap: Record<string, string> = {
        'talking_head': 'Говорящая голова (спикер в кадре смотрит в камеру).',
        'voiceover': 'Эстетичный видеоряд + закадровый голос диктора.',
        'pov': 'Формат POV (Point of View) — зритель видит ситуацию от первого лица.',
        'interview': 'Формат подкаста/интервью (ответы на вопросы невидимого ведущего).'
      };

      const prompt = `Ниша: ${clientNiche}
Напиши вирусные сценарии Reels для следующих тем:
${selectedTitles}

ПАРАМЕТРЫ ЗАКАЗЧИКА:
- Тон повествования: ${toneMap[aiTone] || 'Естественный'}
- Формат видео: ${formatMap[aiFormat] || 'Любой'}

Каждый сценарий должен быть структурирован:
1. hook (Хук - 2-3 секунды)
2. visuals (Что конкретно происходит в кадре - визуал для переданного формата)
3. body (Основная часть диктора - 15-30 сек, написанная в заданном тоне)
4. cta (Призыв к действию)
5. music (Настроение музыки)
6. duration (Ожидаемый хронометраж)

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ С ОБЪЕКТАМИ (без \`\`\` или текста):
[
  { "topicTitle": "Название темы", "hook": "...", "visuals": "...", "body": "...", "cta": "...", "music": "...", "duration": "..." }
]`;

      const systemPrompt = `Ты элитный сценарист Instagram Reels. Твоя задача — писать аутентичные, глубокие тексты.

РЕФЕРЕНС ТВОЕГО СТИЛЯ (Эти тексты — эталон подачи):
Пример 1:
ХУК: Чому у вас випадає волосся, навіть якщо догляд дорогий...
ТЕКСТ: Ви вкладаєте гроші в догляд, але волосся продовжує випадати? Справа не завжди в ціні. Більшість засобів працює тільки з довжиною. А випадіння починається значно глибше — на рівні шкіри голови...
CTA: пиши у дірект слово ВИПАДІННЯ і ми тебе проконсультуємо, або переходь у закріплені сторіс.

Пример 2:
ХУК: 3 помилки, які посилюють випадіння волосся.
ТЕКСТ: Є три помилки. Перша — агресивне миття і травматизація шкіри голови. Друга — повний фокус на довжині... Третя — хаотичний догляд. Тому ми підбираємо догляд комплексно — під стан шкіри.
CTA: Щоб обрати свій комплекс - пиши у дірект.

ПРАВИЛА:
1. Пиши тексты в таком же "нативном", живом стиле (без академизма).
2. Бей в 'боли' аудитории, показывай решение через экспертность.
3. Обязательно давай четкий CTA (кодовое слово в Директ или ссылка на актуальное).
4. Пиши на том же языке, на котором написана Ниша (украинский/русский).`;

      const generated = await fetchGeminiWithSchema(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        ScriptsArraySchema,
        0.7
      );

      if (generated.length === 0) throw new Error('Empty array');

      const newScripts = generated.map((s, i) => ({
        id: Date.now() + i,
        topicTitle: s.topicTitle || topicsToProcess[i]?.title || `Тема`,
        status: 'idea' as ScriptStatus,
        hook: s.hook,
        visuals: s.visuals,
        body: s.body,
        cta: s.cta,
        music: s.music,
        duration: s.duration
      }));

      if (specificTopicId) {
        // Заменяем конкретный
        setScripts(prev => {
          const filtered = prev.filter(p => p.topicTitle !== topicsToProcess[0].title);
          return [newScripts[0], ...filtered];
        });
      } else {
        // Добавляем сверху новые
        setScripts(prev => [...newScripts, ...prev]);
      }
      
      addToast('success', 'Сценарии готовы', 'ИИ написал структурированные тексты.');
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
         addToast('error', 'Ошибка генерации', 'ИИ вернул ответ в неверном формате (Zod). Повторите генерацию.');
      } else {
         addToast('error', 'Ошибка', 'Сбой при генерации сценариев.');
      }
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  return (
    <div className="scenarios-tab content-factory">
      {/* 1. БРИФ КЛИЕНТА */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">1. Кто наш клиент? (Бриф)</h3>
          <p className="ai-section-desc">Опишите нишу, услуги и особенности продукта, чтобы ИИ понимал, о чем писать.</p>
          <textarea
            className="input textarea cf-textarea"
            placeholder="Например: Мастер по кератину в Дубае. Аудитория: девушки экспаты. Выезд на дом."
            value={clientNiche}
            onChange={(e) => setClientNiche(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* 2. КОНКУРЕНТЫ */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">2. Идеи от конкурентов (Опционально)</h3>
          <p className="ai-section-desc">Пусть ИИ найдет успешные паттерны в этой нише, или впишите свои наблюдения.</p>
          <textarea
            className="input textarea cf-textarea"
            placeholder="Что снимают конкуренты..."
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            rows={4}
          />
          <button 
            className={`btn btn-secondary mt-2 ${isGeneratingCompetitors ? 'btn-magic' : ''}`}
            onClick={handleAICompetitors}
            disabled={isGeneratingCompetitors}
          >
            {isGeneratingCompetitors ? '🌐 Сканирую интернет...' : '🌐 Найти их в интернете (Smart Search)'}
          </button>
        </div>
      </div>

      {/* 3. ТЕМЫ РИЛС */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 className="ai-section-title" style={{ marginBottom: '0.2rem' }}>3. Темы постов и Reels</h3>
              <p className="ai-section-desc" style={{ margin: 0 }}>Отметьте нужные галочкой или напишите свои.</p>
            </div>
            <button className="btn btn-primary" onClick={handleGenerateTopics} disabled={isGeneratingTopics}>
              {isGeneratingTopics ? 'Ожидайте...' : '✨ Сгенерировать ИИ'}
            </button>
          </div>

          <div className="topics-list">
            <AnimatePresence>
              {isGeneratingTopics ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={`skel-${i}`} className="magic-skeleton magic-skeleton-topic"></div>
                  ))}
                </motion.div>
              ) : (
                topics.map((topic, i) => (
                  <motion.div 
                    key={topic.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="cf-topic-row"
                  >
                    <input 
                      type="checkbox" 
                      checked={topic.selected} 
                      onChange={() => toggleTopic(topic.id)} 
                      className="cf-checkbox"
                    />
                    <input
                      type="text"
                      className="input cf-topic-input"
                      value={topic.title}
                      onChange={(e) => updateTopicTitle(topic.id, e.target.value)}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeTopic(topic.id)}>✕</button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            {!isGeneratingTopics && (
              <button className="btn btn-dashed mt-2" onClick={handleAddCustomTopic} style={{ width: '100%' }}>
                + Добавить свою тему
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. СЦЕНАРИИ И НАСТРОЙКИ */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">4. Фабрика сценариев</h3>
          <p className="ai-section-desc">Настройте подачу и сгенерируйте детальные сценарии для выбранных тем.</p>
          
          <div className="cf-settings-grid">
            <div className="cf-setting-group">
              <label className="input-label">📝 Тон (Tone of voice)</label>
              <select className="input select" value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                <option value="expert">Строго / Профессионально</option>
                <option value="simple">Разговорно / По-приятельски</option>
                <option value="humorous">С юмором / Иронично</option>
                <option value="provocative">Дерзко / Провокационно</option>
              </select>
            </div>
            <div className="cf-setting-group">
              <label className="input-label">🎥 Формат видео</label>
              <select className="input select" value={aiFormat} onChange={(e) => setAiFormat(e.target.value)}>
                <option value="talking_head">Говорящая голова</option>
                <option value="voiceover">Закадровый голос + Эстетика</option>
                <option value="pov">POV (от первого лица)</option>
                <option value="interview">Подкаст / Интервью</option>
              </select>
            </div>
          </div>

          <button 
            className={`btn btn-primary btn-lg mt-3 ${isGeneratingScripts ? 'btn-magic' : ''}`}
            style={{ width: '100%' }}
            onClick={() => handleGenerateScripts()}
            disabled={isGeneratingScripts}
          >
            {isGeneratingScripts 
              ? '✨ AI пишет сценарии...' 
              : `✍️ Сгенерировать сценарии для ${topics.filter(t => t.selected).length} тем`}
          </button>
        </div>
      </div>

      {/* 5. ИТОГОВЫЕ СЦЕНАРИИ */}
      <AnimatePresence>
        {isGeneratingScripts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
             {[...Array(topics.filter(t => t.selected).length || 1)].map((_, i) => (
               <div key={`skel-s-${i}`} className="magic-skeleton magic-skeleton-script"></div>
             ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!isGeneratingScripts && scripts.length > 0 && (
        <div className="card mt-4">
          <div className="card-body" style={{ textAlign: 'center' }}>
             <h3 className="ai-section-title">✅ Сценарии сгенерированы!</h3>
             <p className="ai-section-desc">Они автоматически перенесены в вашу общую Канбан-доску на главной вкладке <b>"Дашборд"</b>.</p>
          </div>
        </div>
      )}
    </div>
  );
}
