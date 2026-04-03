/* ============================================
   Вкладка 0: Дашборд (Kanban Библиотека)
   Главная навигационная панель контента
   ============================================ */

import { motion } from 'framer-motion';
import { usePersistedState } from '../../../utils/usePersistedState';
import { exportScriptsToWord, exportContentPlanCSV } from '../../../utils/exportUtils';
import { useToastStore } from '../../../store';
import '../Scenarios/ScenariosTab.css'; // Переиспользуем стили Kanban оттуда

interface Props {
  clientId: string;
}

export type ScriptStatus = 'idea' | 'script' | 'shooting' | 'editing' | 'published';

interface ScriptItem {
  id: number;
  topicTitle: string;
  status?: ScriptStatus;
  content?: string;
  hook?: string;
  visuals?: string;
  body?: string;
  cta?: string;
  music?: string;
  duration?: string;
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

  const removeScript = (id: number) => {
    setScripts(scripts.filter(s => s.id !== id));
  };

  return (
    <div className="scenarios-tab content-factory">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mb-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 className="ai-section-title" style={{ margin: 0 }}>🗄️ Библиотека контента и Kanban</h3>
              <p className="ai-section-desc" style={{ margin: 0, opacity: 0.8 }}>Управляйте контентом. Сценарии генерируются во вкладке "Сценарии".</p>
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
                { id: 'idea', title: '💡 Идеи' },
                { id: 'script', title: '✍️ Сценарий' },
                { id: 'shooting', title: '🎥 В съемке' },
                { id: 'editing', title: '✂️ Монтаж' },
                { id: 'published', title: '✅ Готово' },
              ].map(col => {
                const colScripts = scripts.filter(s => (s.status || 'idea') === col.id);
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
                        setScripts(prev => prev.map(s => String(s.id) === scriptId ? { ...s, status: col.id as ScriptStatus } : s));
                      }
                    }}
                  >
                    <div className="kanban-column-header">
                      <span>{col.title}</span>
                      <span className="kanban-badge">{colScripts.length}</span>
                    </div>
                    {colScripts.map(script => (
                      <div 
                        key={script.id} 
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(script.id));
                        }}
                      >
                        <div className="kanban-card-title">{script.topicTitle}</div>
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
      </motion.div>
    </div>
  );
}
