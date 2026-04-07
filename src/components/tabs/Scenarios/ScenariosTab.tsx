/* ============================================
   Фабрика Контента (Scenarios Tab)
   Свободный вертикальный скролл с независимыми блоками
   ============================================ */

import { z } from 'zod';
import { useState } from 'react';
import { useToastStore } from '../../../store';
import { fetchGeminiCompletion, fetchGeminiWithSchema } from '../../../utils/geminiApi';
import { usePersistedState } from '../../../utils/usePersistedState';
import { exportScriptsToWord } from '../../../utils/exportUtils';
import { logActivity } from '../../../utils/activityLogger';
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
  approved?: boolean; // Одобрен пользователем
  content?: string; // Legacy support
  hook?: string;
  visuals?: string;
  body?: string;
  cta?: string;
  music?: string;
  duration?: string;
}

interface TargetItem {
  id: number;
  name: string;
  isPromoted?: boolean;
  results?: string;
  campaignFinished?: boolean;
}

export function ScenariosTab({ clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);

  // --- Persistent States ---
  const [clientNiche, setClientNiche] = usePersistedState(`hw_client_niche_${clientId}`, '');
  const [competitors, setCompetitors] = usePersistedState(`hw_competitors_ai_${clientId}`, '');
  const [topics, setTopics] = usePersistedState<TopicItem[]>(`hw_scenarios_topics_${clientId}`, []);
  const [scripts, setScripts] = usePersistedState<ScriptItem[]>(`hw_scenarios_scripts_${clientId}`, []);
  
  // Монтаж и Таргет (для синхронизации названий)
  const [, setTargetItems] = usePersistedState<TargetItem[]>(`hw_targeting_${clientId}`, []);
  
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
      const prompt = clientNiche.trim()
        ? `Ниша: "${clientNiche}". ${competitors.trim() ? 'Никнеймы: ' + competitors : ''}\n\nПроанализируй успешных конкурентов и тренды в этой нише Instagram. Опиши: какие топики заходят, какой формат Reels популярен, какие хуки цепляют.`
        : `Вот конкуренты: "${competitors}".\n\nПроанализируй их контент и выдели: какие темы заходят, какие форматы популярны, какие хуки используют.`;

      const responseText = await fetchGeminiCompletion(
        [
          { role: 'system', content: 'Ты аналитик Instagram-контента. Делаешь детальный разбор конкурентов в указанной нише.' },
          { role: 'user', content: prompt }
        ],
        0.5,
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
      // Считаем сколько нужно догенерировать (цель: 10 тем)
      const selectedCount = topics.filter(t => t.selected).length;
      const needed = Math.max(10 - selectedCount, 5); // Минимум 5 новых

      const prompt = `Ниша клиента: "${clientNiche}".
${competitors ? 'Анализ трендов и конкурентов:\n' + competitors : ''}
${selectedCount > 0 ? `\nУже выбранные темы (НЕ ПОВТОРЯЙ ИХ):\n${topics.filter(t => t.selected).map(t => `- ${t.title}`).join('\n')}` : ''}

Предложи ${needed} вирусных, кликабельных тем для Reels для этого профиля.
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

      const formatted = generatedTopics.slice(0, needed).map((t, i) => ({
        id: Date.now() + i,
        title: t.title,
        selected: false
      }));

      // Оставляем уже выбранные, заменяем невыбранные
      const keepSelected = topics.filter(t => t.selected);
      setTopics([...keepSelected, ...formatted]);
      addToast('success', 'Темы готовы', `ИИ сгенерировал ${formatted.length} новых тем. Всего ${keepSelected.length + formatted.length}.`);
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
         addToast('error', 'Ошибка структуры ИИ', 'ИИ выдал некорректный ответ (не прошел валидацию Zod). Попробуйте еще раз.');
      } else {
         const errMsg = error instanceof Error ? error.message : 'ИИ вернул неверный формат.';
         addToast('error', 'Ошибка генерации', errMsg);
      }
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // Перегенерировать только невыбранные темы
  const handleRegenerateUnselected = async () => {
    if (!clientNiche.trim()) {
      addToast('warning', 'Пустая ниша', 'Кратко опишите клиента перед генерацией.');
      return;
    }
    const unselectedCount = topics.filter(t => !t.selected).length;
    if (unselectedCount === 0) {
      addToast('info', 'Все темы выбраны', 'Нет невыбранных тем для перегенерации.');
      return;
    }

    setIsGeneratingTopics(true);
    try {
      const selectedTopics = topics.filter(t => t.selected);
      const prompt = `Ниша клиента: "${clientNiche}".
${competitors ? 'Анализ трендов и конкурентов:\n' + competitors : ''}

Уже выбранные темы (НЕ ПОВТОРЯЙ ИХ):
${selectedTopics.map(t => `- ${t.title}`).join('\n')}

Предложи ${unselectedCount} новых вирусных тем для Reels.
ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ:
[{ "id": 1, "title": "Название" }]`;

      const generatedTopics = await fetchGeminiWithSchema(
        [
          { role: 'system', content: 'Ты элитный Instagram-маркетолог. Выдаешь строго JSON-массив уникальных тем.' },
          { role: 'user', content: prompt }
        ],
        TopicsArraySchema,
        0.8
      );

      const formatted = generatedTopics.slice(0, unselectedCount).map((t, i) => ({
        id: Date.now() + i,
        title: t.title,
        selected: false
      }));

      setTopics([...selectedTopics, ...formatted]);
      addToast('success', 'Перегенерация', `Заменены ${formatted.length} невыбранных тем.`);
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка генерации', 'Не удалось перегенерировать темы.');
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
Напиши вирусные сценарии Reels для следующих тем (РОВНО ${topicsToProcess.length} сценариев, по одному на каждую тему):
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

ВАЖНО: Верни РОВНО ${topicsToProcess.length} объектов — по одному на каждую тему выше. Не больше и не меньше.

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

      // Обрезаем до нужного количества (ИИ иногда игнорирует ограничение)
      const trimmed = generated.slice(0, topicsToProcess.length);

      // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: статус = 'idea', approved = false
      // Сценарий станет 'script' ТОЛЬКО когда пользователь одобрит его
      const newScripts = trimmed.map((s, i) => ({
        id: Date.now() + i,
        topicTitle: s.topicTitle || topicsToProcess[i]?.title || `Тема`,
        status: 'idea' as ScriptStatus,
        approved: false,
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
        // Заменяем все неодобренные + добавляем новые
        setScripts(prev => {
          const keepApproved = prev.filter(s => s.approved);
          return [...keepApproved, ...newScripts];
        });
      }
      
      addToast('success', 'Сценарии готовы', 'ИИ написал тексты. Одобрите подходящие галочкой ✅');
      logActivity({ action_type: 'script_generated', client_id: clientId, details: `Сгенерировано ${trimmed.length} сценариев` });
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
         addToast('error', 'Ошибка генерации', 'ИИ вернул ответ в неверном формате (Zod). Повторите генерацию.');
      } else {
         const errMsg = error instanceof Error ? error.message : 'Сбой при генерации сценариев.';
         addToast('error', 'Ошибка генерации', errMsg);
         logActivity({ action_type: 'ai_analysis_error', client_id: clientId, details: `Ошибка сценариев: ${errMsg}` });
      }
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  // --- 4. Одобрение сценариев ---
  const approveScript = (id: number) => {
    setScripts(prev => prev.map(s => {
      if (s.id === id) {
        const newApproved = !s.approved;
        logActivity({
          action_type: newApproved ? 'script_approved' : 'script_status_changed',
          client_id: clientId,
          details: newApproved ? `Одобрен: ${s.topicTitle}` : `Снято одобрение: ${s.topicTitle}`,
        });
        return { 
          ...s, 
          approved: newApproved,
          status: newApproved ? 'script' as ScriptStatus : 'idea' as ScriptStatus
        };
      }
      return s;
    }));
  };

  // Синхронизировать одобренные сценарии → Монтаж (заполнить названия)
  const syncApprovedToEditing = () => {
    const approved = scripts.filter(s => s.approved);
    if (approved.length === 0) {
      addToast('warning', 'Нет одобренных', 'Сначала одобрите сценарии галочкой.');
      return;
    }

    // Записываем названия в targetItems (они же имена публикаций в Монтаже)
    const newTargetItems: TargetItem[] = approved.map((s, i) => ({
      id: i + 1,
      name: s.topicTitle,
      isPromoted: false,
      results: '',
      campaignFinished: false,
    }));

    setTargetItems(newTargetItems);
    addToast('success', 'Синхронизировано', `${approved.length} сценариев перенесены в «Монтаж».`);
  };

  // Перегенерировать неодобренные сценарии
  const handleRegenerateUnapproved = async () => {
    const unapproved = scripts.filter(s => !s.approved);
    if (unapproved.length === 0) {
      addToast('info', 'Все одобрены', 'Нет неодобренных сценариев.');
      return;
    }

    // Собираем темы для перегенерации
    const topicsForRegen = unapproved.map(s => ({
      id: Date.now() + Math.random(),
      title: s.topicTitle,
      selected: true
    }));

    // Временно подставляем и генерируем
    setIsGeneratingScripts(true);
    try {
      const selectedTitles = topicsForRegen.map(t => t.title).join(';\n');
      
      const toneMap: Record<string, string> = {
        'expert': 'Строго профессионально, экспертно, с фактами.',
        'simple': 'Простая разговорная форма, дружелюбно, как с другом.',
        'humorous': 'С юмором, шутками, возможно сарказмом.',
        'provocative': 'Дерзко, вызывающе, через ломку стереотипов.'
      };
      const formatMap: Record<string, string> = {
        'talking_head': 'Говорящая голова.',
        'voiceover': 'Закадровый голос + Эстетика.',
        'pov': 'POV.',
        'interview': 'Подкаст / Интервью.'
      };

      const prompt = `Ниша: ${clientNiche}
Перепиши ДРУГИЕ, ЛУЧШИЕ сценарии для этих тем (${topicsForRegen.length} шт):
${selectedTitles}
Тон: ${toneMap[aiTone] || 'Естественный'}. Формат: ${formatMap[aiFormat] || 'Любой'}.
ВЕРНИ JSON-МАССИВ: [{ "topicTitle": "...", "hook": "...", "visuals": "...", "body": "...", "cta": "...", "music": "...", "duration": "..." }]`;

      const generated = await fetchGeminiWithSchema(
        [{ role: 'system', content: 'Ты сценарист Reels. Пиши живо, без академизма. JSON-массив.' },
         { role: 'user', content: prompt }],
        ScriptsArraySchema,
        0.9 // Повышенная температура для разнообразия
      );

      const newScripts = generated.slice(0, topicsForRegen.length).map((s, i) => ({
        id: Date.now() + i,
        topicTitle: s.topicTitle || topicsForRegen[i]?.title || 'Тема',
        status: 'idea' as ScriptStatus,
        approved: false,
        hook: s.hook,
        visuals: s.visuals,
        body: s.body,
        cta: s.cta,
        music: s.music,
        duration: s.duration
      }));

      setScripts(prev => {
        const keepApproved = prev.filter(s => s.approved);
        return [...keepApproved, ...newScripts];
      });

      addToast('success', 'Перегенерация', `${newScripts.length} сценариев переписаны заново.`);
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка', 'Не удалось перегенерировать.');
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  // === Section Navigation ===
  type Section = 'brief' | 'topics' | 'generate';
  const [activeSection, setActiveSection] = useState<Section>('brief');

  const SECTIONS: { id: Section; label: string; emoji: string; num: number }[] = [
    { id: 'brief', label: 'Бриф', emoji: '📋', num: 1 },
    { id: 'topics', label: 'Темы', emoji: '💡', num: 2 },
    { id: 'generate', label: 'Генерация', emoji: '✨', num: 3 },
  ];

  const TONE_OPTIONS = [
    { value: 'expert', label: '🎓 Экспертно' },
    { value: 'simple', label: '💬 По-приятельски' },
    { value: 'humorous', label: '😄 С юмором' },
    { value: 'provocative', label: '🔥 Дерзко' },
  ];

  const FORMAT_OPTIONS = [
    { value: 'talking_head', label: '🗣 Говорящая голова' },
    { value: 'voiceover', label: '🎬 Закадровый голос' },
    { value: 'pov', label: '👁 POV' },
    { value: 'interview', label: '🎙 Подкаст' },
  ];

  const selectedTopicsCount = topics.filter(t => t.selected).length;
  const unselectedTopicsCount = topics.filter(t => !t.selected).length;
  const approvedScriptsCount = scripts.filter(s => s.approved).length;
  const unapprovedScriptsCount = scripts.filter(s => !s.approved).length;

  return (
    <div className="scenarios-tab content-factory">
      {/* === Section Tabs === */}
      <div className="scenarios-stages">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`scenarios-stage-item ${activeSection === s.id ? 'scenarios-stage-active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            <span className="scenarios-stage-num">{s.num}</span>
            <span>{s.emoji} {s.label}</span>
          </button>
        ))}
      </div>

      {/* === SECTION: Бриф === */}
      {activeSection === 'brief' && (
        <>
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

      <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => setActiveSection('topics')}>
        Далее → Темы 💡
      </button>
        </>
      )}

      {/* === SECTION: Темы === */}
      {activeSection === 'topics' && (
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 className="ai-section-title" style={{ marginBottom: '0.2rem' }}>3. Темы постов и Reels</h3>
              <p className="ai-section-desc" style={{ margin: 0 }}>
                Отметьте галочкой темы, которые нравятся. Цель: набрать 10.
                {topics.length > 0 && <> Выбрано: <b>{selectedTopicsCount}</b> из {topics.length}</>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {unselectedTopicsCount > 0 && selectedTopicsCount > 0 && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={handleRegenerateUnselected} 
                  disabled={isGeneratingTopics}
                >
                  {isGeneratingTopics ? '⏳...' : `🔄 Заменить ${unselectedTopicsCount} невыбранных`}
                </button>
              )}
              <button className="btn btn-primary" onClick={handleGenerateTopics} disabled={isGeneratingTopics}>
                {isGeneratingTopics ? 'Ожидайте...' : topics.length === 0 ? '✨ Сгенерировать ИИ' : '✨ Сгенерировать ещё'}
              </button>
            </div>
          </div>

          <div className="topics-list">
            
              {isGeneratingTopics ? (
                <div className="animate-fade-in">
                  {[...Array(5)].map((_, i) => (
                    <div key={`skel-${i}`} className="magic-skeleton magic-skeleton-topic"></div>
                  ))}
                </div>
              ) : (
                topics.map((topic, i) => (
                  <div 
                    key={topic.id} 
                    className={`cf-topic-row animate-fade-in ${topic.selected ? 'cf-topic-selected' : ''}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
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
                  </div>
                ))
              )}
            
            {!isGeneratingTopics && (
              <button className="btn btn-dashed mt-2" onClick={handleAddCustomTopic} style={{ width: '100%' }}>
                + Добавить свою тему
              </button>
            )}
          </div>

          <button 
            className="btn btn-primary btn-lg mt-3" 
            style={{ width: '100%' }} 
            onClick={() => setActiveSection('generate')}
            disabled={selectedTopicsCount === 0}
          >
            Далее → Генерация ✨ ({selectedTopicsCount} тем выбрано)
          </button>
        </div>
      </div>
      )}

      {/* === SECTION: Генерация === */}
      {activeSection === 'generate' && (
        <>
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">✨ Фабрика сценариев</h3>
          <p className="ai-section-desc">Настройте подачу и сгенерируйте детальные сценарии для выбранных тем.</p>
          
          <div className="cf-settings-grid">
            <div className="toggle-group">
              <span className="toggle-group-label">📝 Тон (Tone of voice)</span>
              <div className="toggle-group-options">
                {TONE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`toggle-option ${aiTone === opt.value ? 'toggle-option-active' : ''}`}
                    onClick={() => setAiTone(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="toggle-group">
              <span className="toggle-group-label">🎥 Формат видео</span>
              <div className="toggle-group-options">
                {FORMAT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`toggle-option ${aiFormat === opt.value ? 'toggle-option-active' : ''}`}
                    onClick={() => setAiFormat(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
              : `✍️ Сгенерировать сценарии для ${selectedTopicsCount} тем`}
          </button>
        </div>
      </div>

      {/* Скелетоны загрузки */}
      {isGeneratingScripts && (
        <div className="animate-fade-in">
           {[...Array(selectedTopicsCount || 1)].map((_, i) => (
             <div key={`skel-s-${i}`} className="magic-skeleton magic-skeleton-script"></div>
           ))}
        </div>
      )}

      {/* === Сценарии: одобрение === */}
      {!isGeneratingScripts && scripts.length > 0 && (
        <div className="card mt-4 animate-fade-in">
          <div className="card-body">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
               <div>
                 <h3 className="ai-section-title" style={{ margin: 0 }}>📋 Одобрение сценариев</h3>
                 <p className="ai-section-desc" style={{ margin: 0 }}>
                   Одобрено: <b>{approvedScriptsCount}</b> из {scripts.length}. 
                   Отметьте ✅ те, что нравятся — они перенесутся в «Монтаж».
                 </p>
               </div>
               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                 {unapprovedScriptsCount > 0 && approvedScriptsCount > 0 && (
                   <button 
                     className="btn btn-secondary btn-sm"
                     onClick={handleRegenerateUnapproved}
                     disabled={isGeneratingScripts}
                   >
                     🔄 Перегенерировать {unapprovedScriptsCount} неодобренных
                   </button>
                 )}
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      exportScriptsToWord(scripts);
                      addToast('success', 'Экспорт', 'Файл .docx скачивается...');
                    }}
                  >
                    📄 Скачать (Word)
                  </button>
                </div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {scripts.map(script => (
                 <div 
                   key={script.id} 
                   style={{ 
                     padding: '1rem', 
                     border: `2px solid ${script.approved ? 'var(--color-success, #22c55e)' : 'var(--color-border)'}`, 
                     borderRadius: 'var(--radius-md)', 
                     background: script.approved ? 'rgba(34, 197, 94, 0.04)' : 'var(--color-bg)',
                     transition: 'all 0.2s ease'
                   }}
                 >
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <button
                         className={`cf-approve-btn ${script.approved ? 'approved' : ''}`}
                         onClick={() => approveScript(script.id)}
                         title={script.approved ? 'Одобрено' : 'Одобрить сценарий'}
                       >
                         {script.approved && (
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                             <polyline points="20 6 9 17 4 12"></polyline>
                           </svg>
                         )}
                       </button>
                       <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }} onClick={() => approveScript(script.id)}>
                         {script.topicTitle}
                       </h4>
                     </div>
                     <button 
                       className="btn btn-ghost btn-sm"
                       onClick={() => {
                         const text = `Хук: ${script.hook}\nВидеоряд: ${script.visuals}\nСценарий: ${script.body}\nCTA: ${script.cta}`;
                         navigator.clipboard.writeText(text);
                         addToast('success', 'Скопировано', 'Текст скопирован в буфер обмена');
                       }}
                     >
                       📋
                     </button>
                   </div>
                   <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     <div><b>Хук:</b> {script.hook}</div>
                     <div><b>Сценарий:</b> {script.body}</div>
                     {script.cta && <div><b>CTA:</b> {script.cta}</div>}
                   </div>
                 </div>
               ))}
             </div>

              {/* Большая кнопка переноса в Монтаж — после списка сценариев */}
              {approvedScriptsCount > 0 && (
                <button 
                  className="btn btn-primary"
                  onClick={syncApprovedToEditing}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    marginTop: '1.5rem',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  📤 Перенести {approvedScriptsCount} в «Монтаж»
                </button>
              )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
