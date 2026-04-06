/* ============================================
   Вкладка 0: Дашборд (Kanban Библиотека)
   Статусы:
   - idea: сгенерированный сценарий (ещё не одобрен)
   - script: одобренный сценарий (пользователь поставил ✅)
   - shooting: исходник получен (Монтаж: sourceReceived)
   - editing: смонтировано (Монтаж: editingDone)
   - published: полностью готово (Монтаж: все галочки)
   ============================================ */

import { useEffect } from 'react';
import { usePersistedState } from '../../../utils/usePersistedState';
import { exportScriptsToWord, exportContentPlanCSV } from '../../../utils/exportUtils';
import { useToastStore } from '../../../store';
import '../Scenarios/ScenariosTab.css';

interface Props {
  clientId: string;
}

export type ScriptStatus = 'idea' | 'script' | 'shooting' | 'editing' | 'published';

interface ScriptItem {
  id: number;
  topicTitle: string;
  status?: ScriptStatus;
  approved?: boolean;
  content?: string;
  hook?: string;
  visuals?: string;
  body?: string;
  cta?: string;
  music?: string;
  duration?: string;
}

interface EditItem {
  id: number;
  sourceReceived: boolean;
  editingDone: boolean;
  coverDone: boolean;
  deliveredToClient: boolean;
}

export function DashboardTab({ clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const [scripts, setScripts] = usePersistedState<ScriptItem[]>(`hw_scenarios_scripts_${clientId}`, []);
  const [topics] = usePersistedState<{ id: number; title: string; selected: boolean }[]>(`hw_scenarios_topics_${clientId}`, []);
  const [formatSlots] = usePersistedState<{ id: number; format: 'reels' | 'post' | 'carousel' | null }[]>(
    `hw_formats_slots_${clientId}`, []
  );
  const [targetItems] = usePersistedState<{ id: number; name: string }[]>(
    `hw_targeting_${clientId}`, []
  );

  // Читаем данные Монтажа для авто-синхронизации
  const [editingItems] = usePersistedState<EditItem[]>(`hw_editing_${clientId}`, []);

  // === Авто-синхронизация статусов Kanban с Монтажом ===
  // Только для ОДОБРЕННЫХ скриптов (approved === true)
  // Одобренный скрипт i → публикация (порядковый номер среди одобренных) в Монтаже
  useEffect(() => {
    if (scripts.length === 0) return;

    let changed = false;
    // Получаем порядок одобренных скриптов
    const approvedScripts = scripts.filter(s => s.approved);

    const updated = scripts.map((script) => {
      // Если скрипт не одобрен — всегда 'idea'
      if (!script.approved) {
        if (script.status !== 'idea' && script.status !== undefined) {
          changed = true;
          return { ...script, status: 'idea' as ScriptStatus };
        }
        return script;
      }

      // Скрипт одобрен — синхронизируем с Монтажом
      const approvedIndex = approvedScripts.findIndex(a => a.id === script.id);
      const editItem = editingItems.find(e => e.id === approvedIndex + 1);
      let newStatus: ScriptStatus = script.status || 'script';

      // Минимальный статус для одобренного — 'script'
      if (newStatus === 'idea') newStatus = 'script';

      if (editItem) {
        if (editItem.deliveredToClient && editItem.editingDone && editItem.coverDone) {
          newStatus = 'published';
        } else if (editItem.editingDone) {
          newStatus = 'editing';
        } else if (editItem.sourceReceived) {
          newStatus = 'shooting';
        }
      }

      // Только двигаем вперёд (не назад)
      const ORDER: ScriptStatus[] = ['idea', 'script', 'shooting', 'editing', 'published'];
      const currentRank = ORDER.indexOf(script.status || 'idea');
      const newRank = ORDER.indexOf(newStatus);

      if (newRank > currentRank) {
        changed = true;
        return { ...script, status: newStatus };
      }

      return script;
    });

    if (changed) {
      setScripts(updated);
    }
  }, [editingItems]);

  const removeScript = (id: number) => {
    setScripts(scripts.filter(s => s.id !== id));
  };

  // Статус → человекопонятный бейдж
  const statusInfo = (status: ScriptStatus) => {
    const map: Record<ScriptStatus, { color: string; bg: string }> = {
      idea: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
      script: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
      shooting: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      editing: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
      published: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    };
    return map[status] || map.idea;
  };

  return (
    <div className="scenarios-tab content-factory">
      <div className="card mb-4 animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 className="ai-section-title" style={{ margin: 0 }}>🗄️ Библиотека контента и Kanban</h3>
              <p className="ai-section-desc" style={{ margin: 0, opacity: 0.8 }}>
                Сценарии двигаются по этапам: Идея → Одобренный → Съемка → Монтаж → Готово. Статусы обновляются автоматически.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  exportScriptsToWord(scripts);
                  addToast('success', 'Экспорт', 'Сценарии.docx скачивается...');
                }}
              >
                📄 Скачать скрипты
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  exportContentPlanCSV(formatSlots, targetItems, topics);
                  addToast('success', 'Экспорт', 'Контент-план.csv скачивается...');
                }}
              >
                📊 Таблица планов
              </button>
            </div>
          </div>
          
          <div className="kanban-container" style={{ marginTop: '1.5rem' }}>
            <div className="kanban-board">
              {[
                { id: 'idea', title: '💡 Идеи', desc: 'Ещё не одобрены' },
                { id: 'script', title: '✅ Одобрены', desc: 'Готовы к съемке' },
                { id: 'shooting', title: '🎥 В съемке', desc: 'Исходник получен' },
                { id: 'editing', title: '✂️ Монтаж', desc: 'В работе' },
                { id: 'published', title: '🎉 Готово', desc: 'Выдано' },
              ].map(col => {
                const colScripts = scripts.filter(s => (s.status || 'idea') === col.id);
                const si = statusInfo(col.id as ScriptStatus);
                return (
                  <div 
                    key={col.id}
                    className="kanban-column"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('drag-over');
                      const scriptId = e.dataTransfer.getData('text/plain');
                      if (scriptId) {
                        setScripts(prev => prev.map(s => {
                          if (String(s.id) === scriptId) {
                            // Если перетаскиваем из idea в script — автоматически одобряем
                            const isApproving = col.id === 'script' || col.id === 'shooting' || col.id === 'editing' || col.id === 'published';
                            return { ...s, status: col.id as ScriptStatus, approved: isApproving ? true : s.approved };
                          }
                          return s;
                        }));
                      }
                    }}
                  >
                    <div className="kanban-column-header">
                      <span>{col.title}</span>
                      <span className="kanban-badge" style={{ background: si.bg, color: si.color }}>{colScripts.length}</span>
                    </div>
                    {colScripts.map(script => (
                      <div 
                        key={script.id} 
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(script.id));
                        }}
                        style={{ borderLeft: `3px solid ${si.color}` }}
                      >
                        <div className="kanban-card-title">{script.topicTitle}</div>
                        {script.approved && (
                          <span style={{ fontSize: '10px', color: si.color, fontWeight: 600 }}>
                            {script.approved ? '✅ Одобрен' : ''}
                          </span>
                        )}
                        <details className="kanban-card-details">
                          <summary style={{ fontSize: '12px', color: 'var(--color-primary)', cursor: 'pointer', marginBottom: '8px' }}>
                            Посмотреть текст
                          </summary>
                          <div style={{ fontSize: '12px', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {script.hook && <div><b>Хук:</b> {script.hook}</div>}
                            {script.visuals && <div><b>Видеоряд:</b> {script.visuals}</div>}
                            {script.body && <div><b>Текст:</b> {script.body}</div>}
                            {script.cta && <div><b>CTA:</b> {script.cta}</div>}
                          </div>
                        </details>
                        <div className="kanban-card-actions">
                           <button 
                            className="btn btn-ghost btn-sm"
                            title="Скопировать"
                            style={{ padding: '0 4px' }}
                            onClick={() => {
                              const text = `Хук: ${script.hook}\nВидеоряд: ${script.visuals}\nСценарий: ${script.body}\nCTA: ${script.cta}`;
                              navigator.clipboard.writeText(text);
                              addToast('success', 'Скопировано', 'Текст в буфере');
                            }}
                           >📋</button>
                           <button 
                             className="btn btn-ghost btn-sm" 
                             style={{ padding: '0 4px', color: 'var(--color-danger)' }}
                             onClick={() => removeScript(script.id)}
                            >🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
