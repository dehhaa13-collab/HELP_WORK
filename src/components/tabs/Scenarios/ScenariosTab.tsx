/* ============================================
   Вкладка 3: Сценарии и выбор тем
   3 этапа: Конкуренты -> Темы -> Сценарии
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
import { fetchGrokCompletion } from '../../../utils/grokApi';
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
  content: string;
}

type Stage = 'competitors' | 'topics' | 'scripts';

export function ScenariosTab({ clientId: _clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const [stage, setStage] = useState<Stage>('competitors');
  const [competitorLinks, setCompetitorLinks] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [scripts, setScripts] = useState<ScriptItem[]>([]);

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

      const responseText = await fetchGrokCompletion([
        { role: 'system', content: 'Ты опытный Instagram-продюсер. Ты возвращаешь строго JSON-массив без markdown разметки и без дополнительного текста.' },
        { role: 'user', content: prompt }
      ]);
      
      // Clean potential markdown blocks
      const cleanJson = responseText.replace(/```(json)?/g, '').trim();
      let generatedTopics: TopicItem[];
      try {
        generatedTopics = JSON.parse(cleanJson);
        // Map to ensure properties are as expected
        generatedTopics = generatedTopics.slice(0, 12).map((t, i) => ({
          id: i + 1,
          title: t.title || 'Без названия',
          selected: false
        }));
      } catch (e) {
        console.error("Failed to parse JSON from Grok:", responseText);
        throw new Error('Invalid JSON format from AI');
      }

      if (!generatedTopics || generatedTopics.length === 0) {
        throw new Error('Empty topics');
      }

      setTopics(generatedTopics);
      setStage('topics');
      addToast('success', 'Темы сгенерированы', 'ИИ предложил темы на основе анализа конкурентов. Выберите до 10.');
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка генерации', 'Не удалось проанализировать конкурентов (проверьте консоль).');
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

Каждый сценарий должен иметь:
1. Хук (2 секунды)
2. Основная часть (15-30 сек)
3. Призыв к действию (CTA)
4. Подобранную музыку или тренд
5. Ожидаемый хронометраж.

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON-МАССИВ (без блочных кавычек \`\`\`):
[
  { "id": 1, "topicTitle": "Тема 1", "content": "Текст сценария в markdown..." },
  { "id": 2, "topicTitle": "Тема 2", "content": "Текст сценария в markdown..." }
]`;

      const responseText = await fetchGrokCompletion([
        { role: 'system', content: 'Ты креативный сценарист Reels. Возвращай строго JSON-массив без markdown блока.' },
        { role: 'user', content: prompt }
      ]);

      const cleanJson = responseText.replace(/```(json)?/g, '').trim();
      let generatedScripts: ScriptItem[];
      try {
        generatedScripts = JSON.parse(cleanJson);
        generatedScripts = generatedScripts.map((s, i) => ({
          id: i + 1,
          topicTitle: s.topicTitle || selectedTopics[i]?.title || 'Сценарий',
          content: s.content || ''
        }));
      } catch (e) {
        console.error("Failed to parse scripts from Grok:", responseText);
        throw new Error('Invalid JSON');
      }

      setScripts(generatedScripts);
      setStage('scripts');
      addToast('success', 'Сценарии готовы', `Сгенерировано ${generatedScripts.length} сценариев.`);
    } catch (error) {
      console.error(error);
      addToast('error', 'Ошибка генерации', 'Не удалось сгенерировать сценарии.');
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
                <h4 className="script-title">Сценарий #{script.id}</h4>
                <div className="script-content">
                  {script.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
