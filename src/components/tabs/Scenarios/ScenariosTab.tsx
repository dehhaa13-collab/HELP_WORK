/* ============================================
   Фабрика Контента (Scenarios Tab)
   Свободный вертикальный скролл с независимыми блоками
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
import { fetchGeminiCompletion, extractJsonFromText } from '../../../utils/geminiApi';
import { usePersistedState } from '../../../utils/usePersistedState';
import './ScenariosTab.css';

interface Props {
  clientId: string;
}

interface TopicItem {
  id: number;
  title: string;
  selected: boolean;
}

interface ScriptItem {
  id: number;
  topicTitle: string;
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

  // --- 1. Анализ Конкурентов (ИИ) ---
  const handleAICompetitors = async () => {
    if (!clientNiche.trim()) {
      addToast('warning', 'Пустая ниша', 'Сначала опишите, чем занимается клиент.');
      return;
    }
    setIsGeneratingCompetitors(true);
    try {
      const prompt = `Пользователь работает в нише: "${clientNiche}".
Опиши 3 собирательных образа самых топовых и вирусных конкурентов в этой нише в Instagram на текущий год.
Какие форматы Reels они делают? Какие фишки используют?
Ответь кратко, без воды, чисто практические идеи для вдохновения.`;

      const responseText = await fetchGeminiCompletion(
        [{ role: 'user', content: prompt }], 
        0.7, 
        'gemini-1.5-flash',
        'text/plain'
      );
      
      setCompetitors(responseText.trim());
      addToast('success', 'Анализ завершен', 'ИИ предложил стратегию конкурентов.');
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка', 'Не удалось сгенерировать конкурентов.');
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

      const responseText = await fetchGeminiCompletion(
        [
          { role: 'system', content: 'Ты Instagram-маркетолог. Выдаешь строго JSON-массив.' },
          { role: 'user', content: prompt }
        ],
        0.7,
        'gemini-1.5-flash'
      );

      const generatedTopics = extractJsonFromText(responseText) as unknown as { id: number, title: string }[];
      if (!Array.isArray(generatedTopics)) throw new Error('Invalid JSON format');

      const formatted = generatedTopics.slice(0, 15).map((t, i) => ({
        id: Date.now() + i,
        title: t.title,
        selected: false
      }));

      // Добавляем к существующим темам или заменяем
      setTopics(formatted);
      addToast('success', 'Темы готовы', `ИИ сгенерировал ${formatted.length} тем.`);
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка генерации', 'ИИ вернул неверный формат.');
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

      const responseText = await fetchGeminiCompletion(
        [{ role: 'system', content: 'Ты элитный сценарист.' }, { role: 'user', content: prompt }],
        0.7,
        'gemini-1.5-flash'
      );

      const generated = extractJsonFromText(responseText) as unknown as any[];
      if (!Array.isArray(generated) || generated.length === 0) throw new Error('Empty or invalid output');

      const newScripts = generated.map((s, i) => ({
        id: Date.now() + i,
        topicTitle: s.topicTitle || topicsToProcess[i]?.title || `Тема`,
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
      addToast('error', 'Ошибка', 'Сбой при генерации сценариев.');
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  const removeScript = (id: number) => {
    setScripts(scripts.filter(s => s.id !== id));
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
            className="btn btn-secondary mt-2" 
            onClick={handleAICompetitors}
            disabled={isGeneratingCompetitors}
          >
            {isGeneratingCompetitors ? '🤖 Анализирую рынок...' : '🤖 Спросить ИИ про конкурентов'}
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
            {topics.map(topic => (
              <div key={topic.id} className="cf-topic-row">
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
            ))}
            <button className="btn btn-dashed mt-2" onClick={handleAddCustomTopic} style={{ width: '100%' }}>
              + Добавить свою тему
            </button>
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
            className="btn btn-primary btn-lg mt-3" 
            style={{ width: '100%' }}
            onClick={() => handleGenerateScripts()}
            disabled={isGeneratingScripts}
          >
            {isGeneratingScripts 
              ? '🤖 Пишу сценарии...' 
              : `✍️ Сгенерировать сценарии для ${topics.filter(t => t.selected).length} тем`}
          </button>
        </div>
      </div>

      {/* 5. ИТОГОВЫЕ СЦЕНАРИИ */}
      {scripts.length > 0 && (
        <div className="scenarios-scripts">
          <h3 className="ai-section-title" style={{ marginTop: '1rem' }}>📦 Сохраненные сценарии ({scripts.length})</h3>
          
          {scripts.map((script) => (
            <div key={script.id} className="card script-card">
              <div className="card-body">
                <div className="script-actions" style={{ marginBottom: '1rem' }}>
                  <h4 className="script-title" style={{ marginBottom: 0 }}>{script.topicTitle}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleGenerateScripts(
                        topics.find(t => t.title === script.topicTitle)?.id || undefined
                      )}
                    >
                      🔄 Переписать
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const text = `Хук: ${script.hook}\nВидеоряд: ${script.visuals}\nСценарий: ${script.body}\nCTA: ${script.cta}`;
                        navigator.clipboard.writeText(text);
                        addToast('success', 'Скопировано', 'Сценарий в буфере');
                      }}
                    >
                      📋 Скопировать
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeScript(script.id)}>
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="script-structured">
                  {script.hook && (
                    <div className="script-section">
                      <span className="script-label">🎣 Хук</span>
                      <p>{script.hook}</p>
                    </div>
                  )}
                  {script.visuals && (
                    <div className="script-section">
                      <span className="script-label">🎬 Обстановка / Видеоряд</span>
                      <p>{script.visuals}</p>
                    </div>
                  )}
                  {script.body && (
                    <div className="script-section">
                      <span className="script-label">🗣 Сценарий / Текст диктора</span>
                      <p>{script.body}</p>
                    </div>
                  )}
                  {script.cta && (
                    <div className="script-section">
                      <span className="script-label">🎯 Призыв (CTA)</span>
                      <p>{script.cta}</p>
                    </div>
                  )}
                  <div className="script-footer">
                    <span>🎵 Звук: {script.music || 'Тренд'}</span>
                    <span>⏱ Время: {script.duration || '~15 сек'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
