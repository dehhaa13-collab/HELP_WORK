/* ============================================
   Вкладка 3: Сценарии и выбор тем
   3 этапа: Конкуренты -> Темы -> Сценарии
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
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
      // TODO: Grok API
      await new Promise((r) => setTimeout(r, 2000));

      const generatedTopics: TopicItem[] = [
        { id: 1, title: 'Закулисье работы мастера: один день из жизни', selected: false },
        { id: 2, title: 'До/После: трансформация клиента', selected: false },
        { id: 3, title: 'Топ-5 ошибок, которые совершают клиенты', selected: false },
        { id: 4, title: 'Ответы на часто задаваемые вопросы', selected: false },
        { id: 5, title: 'Тренды 2026: что сейчас в моде', selected: false },
        { id: 6, title: 'Разбор популярного мифа в нише', selected: false },
        { id: 7, title: 'Лайфхак: как сохранить результат дольше', selected: false },
        { id: 8, title: 'Отзыв довольного клиента (UGC формат)', selected: false },
        { id: 9, title: 'Обзор продукта/инструмента, которым пользуется мастер', selected: false },
        { id: 10, title: 'Мотивационное видео: история мастера и путь к успеху', selected: false },
        { id: 11, title: 'Как выбрать правильного мастера (чек-лист)', selected: false },
        { id: 12, title: 'Процесс работы крупным планом (ASMR/атмосфера)', selected: false },
      ];

      setTopics(generatedTopics);
      setStage('topics');
      addToast('success', 'Темы сгенерированы', 'ИИ предложил 12 тем на основе анализа конкурентов. Выберите 10.');
    } catch {
      addToast('error', 'Ошибка генерации', 'Не удалось проанализировать конкурентов.');
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
      // TODO: Grok API
      await new Promise((r) => setTimeout(r, 3000));

      const generatedScripts: ScriptItem[] = selectedTopics.map((topic, i) => ({
        id: i + 1,
        topicTitle: topic.title,
        content:
          `🎬 Сценарий #${i + 1}: ${topic.title}\n\n` +
          `📍 Хук (первые 2 секунды):\n«Вы точно делаете ЭТУ ошибку...»\n\n` +
          `📍 Основная часть (15-30 сек):\n` +
          `- Показать проблему/процесс\n` +
          `- Дать экспертное объяснение\n` +
          `- Визуальная демонстрация\n\n` +
          `📍 Призыв к действию:\n«Запишитесь по ссылке в описании — осталось 3 места на эту неделю»\n\n` +
          `🎵 Музыка: Трендовый звук (подобрать актуальный)\n` +
          `⏱ Хронометраж: 25-40 сек`,
      }));

      setScripts(generatedScripts);
      setStage('scripts');
      addToast('success', 'Сценарии готовы', `Сгенерировано ${generatedScripts.length} сценариев.`);
    } catch {
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
              style={{ marginTop: 'var(--space-4)' }}
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
              style={{ marginTop: 'var(--space-4)' }}
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
