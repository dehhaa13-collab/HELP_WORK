/* ============================================
   Вкладка 3: Сценарии и выбор тем
   3 этапа: Конкуренты -> Темы -> Сценарии
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

type Stage = 'competitors' | 'topics' | 'scripts';

export function ScenariosTab({ clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const [stage, setStage] = usePersistedState<Stage>(`hw_scenarios_stage_${clientId}`, 'competitors');
  const [competitorLinks, setCompetitorLinks] = usePersistedState(`hw_scenarios_links_${clientId}`, '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [topics, setTopics] = usePersistedState<TopicItem[]>(`hw_scenarios_topics_${clientId}`, []);
  const [scripts, setScripts] = usePersistedState<ScriptItem[]>(`hw_scenarios_scripts_${clientId}`, []);

  const handleAnalyzeCompetitors = async () => {
    if (!competitorLinks.trim()) {
      addToast('warning', 'Вставьте ссылки', 'Укажите ссылки на Reels конкурентов для анализа.');
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = `Пожалуйста, проанализируй следующие ссылки конкурентов (или представь, что ты это сделал, основываясь на трендах ниши, если не можешь перейти по ссылкам) и предложи ровно 12 актуальных, вирусных тем для Reels:
${competitorLinks}

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ С ОБЪЕКТАМИ (без блочных кавычек \`\`\`, без лишнего текста):
[
  { "id": 1, "title": "Название темы 1" },
  { "id": 2, "title": "Название темы 2" },
  ...
]`;

      const responseText = await fetchGeminiCompletion([
        { role: 'system', content: 'Ты опытный Instagram-продюсер. Строго придерживайся JSON структуры и не возвращай ничего, кроме JSON.' },
        { role: 'user', content: prompt }
      ]);
      
      // Агрессивная экстракция JSON
      let generatedTopics: TopicItem[];
      try {
        generatedTopics = extractJsonFromText(responseText) as unknown as TopicItem[];
      } catch (e) {
        console.error("[Сценарии] Ошибка извлечения JSON:", responseText);
        throw new Error('ИИ вернул ответ в неверном формате (не JSON). Проверьте консоль.');
      }

      // Строгая валидация — если данные кривые, лучше честная ошибка
      if (!Array.isArray(generatedTopics) || generatedTopics.length === 0) {
        console.error('[Сценарии] ИИ вернул пустой или не-массив:', generatedTopics);
        throw new Error('ИИ не сгенерировал ни одной темы. Попробуйте переформулировать запрос.');
      }

      // Проверить что каждая тема имеет title
      const invalidTopics = generatedTopics.filter(t => !t.title || typeof t.title !== 'string');
      if (invalidTopics.length > 0) {
        console.error('[Сценарии] Топики без title:', invalidTopics);
        throw new Error(`ИИ вернул ${invalidTopics.length} тем без названия. Попробуйте ещё раз.`);
      }

      generatedTopics = generatedTopics.slice(0, 12).map((t, i) => ({
        id: i + 1,
        title: t.title,
        selected: false
      }));

      setTopics(generatedTopics);
      setStage('topics');
      addToast('success', 'Темы сгенерированы', `ИИ предложил ${generatedTopics.length} тем. Выберите до 10.`);
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка генерации', errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTopic = (id: number) => {
    const selectedCount = topics.filter((t) => t.selected).length;
    const topic = topics.find((t) => t.id === id);

    if (topic && !topic.selected && selectedCount >= 10) {
      addToast('info', 'Лимит тем', 'Вы уже выбрали 10 тем. Снимите выделение с одной, чтобы выбрать другую.');
      return;
    }

    setTopics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleGenerateScripts = async () => {
    const selectedTopics = topics.filter((t) => t.selected);
    if (selectedTopics.length === 0) {
      addToast('warning', 'Выберите темы', 'Отметьте хотя бы одну тему для генерации сценариев.');
      return;
    }

    setIsGenerating(true);

    try {
      const selectedTitles = selectedTopics.map(t => t.title).join('; ');
      const prompt = `Напиши короткие вирусные сценарии Reels для следующих тем:
${selectedTitles}

Каждый сценарий должен быть структурирован:
1. hook (Хук - 2-3 секунды, самая интригующая фраза)
2. visuals (Что происходит в кадре - визуал, действия, текст на экране)
3. body (Основная часть диктора - 15-30 сек)
4. cta (Призыв к действию, подписка/комментарий)
5. music (Настроение музыки или тренд)
6. duration (Ожидаемый хронометраж)

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ (без блочных кавычек \`\`\`):
[
  { 
    "id": 1, 
    "topicTitle": "Название темы", 
    "hook": "Текст...", 
    "visuals": "Камера наезжает...", 
    "body": "Текст...", 
    "cta": "Подпишись...", 
    "music": "Динамичная...", 
    "duration": "15 сек" 
  }
]`;

      const responseText = await fetchGeminiCompletion([
        { role: 'system', content: 'Ты креативный сценарист Reels. Возвращай строго JSON-массив.' },
        { role: 'user', content: prompt }
      ]);

      // Агрессивная экстракция JSON
      let generatedScripts: ScriptItem[];
      try {
        generatedScripts = extractJsonFromText(responseText) as unknown as ScriptItem[];
      } catch (e) {
        console.error("[Сценарии] Ошибка извлечения JSON для сценариев:", responseText);
        throw new Error('ИИ вернул ответ в неверном формате (не JSON). Проверьте консоль.');
      }

      if (!Array.isArray(generatedScripts) || generatedScripts.length === 0) {
        console.error('[Сценарии] Пустой массив сценариев:', generatedScripts);
        throw new Error('ИИ не сгенерировал ни одного сценария. Попробуйте ещё раз.');
      }

      // Проверить что сценарии содержат данные
      const emptyScripts = generatedScripts.filter(s => 
        (!s.content || s.content.length < 5) && 
        (!s.body || s.body.length < 5)
      );
      if (emptyScripts.length > 0) {
        console.error('[Сценарии] Сценарии без контента:', emptyScripts);
        throw new Error(`ИИ вернул ${emptyScripts.length} пустых сценариев. Попробуйте ещё раз.`);
      }

      generatedScripts = generatedScripts.map((s, i) => ({
        id: i + 1,
        topicTitle: s.topicTitle || selectedTopics[i]?.title || `Тема ${i + 1}`,
        content: s.content,
        hook: s.hook,
        visuals: s.visuals,
        body: s.body,
        cta: s.cta,
        music: s.music,
        duration: s.duration
      }));

      setScripts(generatedScripts);
      setStage('scripts');
      addToast('success', 'Сценарии готовы', `Сгенерировано ${generatedScripts.length} сценариев.`);
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      addToast('error', 'Ошибка генерации', errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCount = topics.filter((t) => t.selected).length;

  return (
    <div className="scenarios-tab">
      {/* Stage Indicator */}
      <div className="scenarios-stages">
        {(['competitors', 'topics', 'scripts'] as Stage[]).map((s, i) => (
          <div
            key={s}
            className={`scenarios-stage-item ${stage === s ? 'scenarios-stage-active' : ''} ${
              (['competitors', 'topics', 'scripts'].indexOf(stage)) > i ? 'scenarios-stage-done' : ''
            }`}
            onClick={() => {
              if (i <= ['competitors', 'topics', 'scripts'].indexOf(stage)) {
                setStage(s);
              }
            }}
          >
            <span className="scenarios-stage-num">{i + 1}</span>
            <span className="scenarios-stage-label">
              {s === 'competitors' && 'Конкуренты'}
              {s === 'topics' && 'Темы'}
              {s === 'scripts' && 'Сценарии'}
            </span>
          </div>
        ))}
      </div>

      {/* Stage 1: Competitors */}
      {stage === 'competitors' && (
        <div className="card">
          <div className="card-body">
            <h3 className="ai-section-title">🔍 Анализ конкурентов</h3>
            <p className="ai-section-desc">
              Вставьте ссылки на вирусные Reels конкурентов (каждая ссылка с новой строки).
              ИИ проанализирует, что залетает, и предложит темы.
            </p>
            <textarea
              className="input textarea"
              placeholder="https://www.instagram.com/reel/..."
              value={competitorLinks}
              onChange={(e) => setCompetitorLinks(e.target.value)}
              rows={6}
            />
            <button
              className="btn btn-primary btn-lg ai-analyze-btn"
              onClick={handleAnalyzeCompetitors}
              disabled={isGenerating}
              style={{ marginTop: '1rem' }}
            >
              {isGenerating ? (
                <>
                  <span className="login-spinner" /> Анализирую...
                </>
              ) : (
                '🤖 Проанализировать и предложить темы'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Topics */}
      {stage === 'topics' && (
        <div className="card">
          <div className="card-body">
            <h3 className="ai-section-title">💡 Выбор тем ({selectedCount}/10)</h3>
            <p className="ai-section-desc">
              ИИ предложил темы на основе анализа. Выберите до 10 тем для генерации сценариев.
            </p>
            <div className="topics-list">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className={`topic-item ${topic.selected ? 'topic-item-selected' : ''}`}
                  onClick={() => toggleTopic(topic.id)}
                >
                  <div className={`topic-checkbox ${topic.selected ? 'topic-checkbox-checked' : ''}`}>
                    {topic.selected && '✓'}
                  </div>
                  <span className="topic-title">{topic.title}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-lg ai-analyze-btn"
              onClick={handleGenerateScripts}
              disabled={isGenerating || selectedCount === 0}
              style={{ marginTop: '1rem' }}
            >
              {isGenerating ? (
                <>
                  <span className="login-spinner" /> Генерирую сценарии...
                </>
              ) : (
                `📝 Сгенерировать ${selectedCount} сценариев`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Scripts */}
      {stage === 'scripts' && (
        <div className="scenarios-scripts">
          <div className="scenarios-scripts-header">
            <h3 className="ai-section-title">📝 Готовые сценарии ({scripts.length})</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setStage('topics')}>
              ← К темам
            </button>
          </div>
          {scripts.map((script) => (
            <div key={script.id} className="card script-card">
              <div className="card-body">
                <div className="script-actions">
                  <h4 className="script-title">{script.topicTitle}</h4>
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const textToCopy = script.content 
                        ? script.content 
                        : `Хук: ${script.hook}\n\nВидеоряд: ${script.visuals}\n\nСценарий: ${script.body}\n\nCTA: ${script.cta}`;
                      navigator.clipboard.writeText(textToCopy);
                      addToast('success', 'Скопировано', 'Сценарий скопирован в буфер обмена');
                    }}
                  >
                    📋 Копировать
                  </button>
                </div>
                
                {(!script.hook && script.content) ? (
                  <div className="script-content">
                    {script.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
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
                      <span>🎵 Звук/Музыка: {script.music || 'Любой тренд'}</span>
                      <span>⏱ Время: {script.duration || '~15 сек'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
