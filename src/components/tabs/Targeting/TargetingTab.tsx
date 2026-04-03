/* ============================================
   Вкладка 5: Таргет / Аналитика
   Управление рекламой по каждой публикации
   ============================================ */

import { usePersistedState } from '../../../utils/usePersistedState';
import './TargetingTab.css';

interface Props {
  clientId: string;
}

interface TargetItem {
  id: number;
  name: string;
  isPromoted: boolean;
  results: string;
  campaignFinished: boolean;
}

export function TargetingTab({ clientId }: Props) {
  // Синхронизация с количеством слотов из вкладки Форматы
  const [slotCount] = usePersistedState<number>(`hw_formats_count_${clientId}`, 10);

  const [items, setItems] = usePersistedState<TargetItem[]>(
    `hw_targeting_${clientId}`,
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: '',
      isPromoted: false,
      results: '',
      campaignFinished: false,
    }))
  );

  // Динамическая подстройка количества строк
  const syncedItems = (() => {
    if (items.length < slotCount) {
      const extra = Array.from({ length: slotCount - items.length }, (_, i) => ({
        id: items.length + i + 1,
        name: '',
        isPromoted: false,
        results: '',
        campaignFinished: false,
      }));
      return [...items, ...extra];
    }
    return items.slice(0, slotCount);
  })();

  // Обновляем persisted state при изменении, используя syncedItems как базу
  const updateItem = (id: number, patch: Partial<TargetItem>) => {
    setItems(
      syncedItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
  };

  const togglePromoted = (id: number) => {
    const current = syncedItems.find(i => i.id === id);
    updateItem(id, { isPromoted: !current?.isPromoted });
  };

  const toggleFinished = (id: number) => {
    const current = syncedItems.find(i => i.id === id);
    updateItem(id, { campaignFinished: !current?.campaignFinished });
  };

  const updateResults = (id: number, results: string) => updateItem(id, { results });
  const updateName = (id: number, name: string) => updateItem(id, { name });

  const promotedCount = syncedItems.filter((i) => i.isPromoted).length;
  const finishedCount = syncedItems.filter((i) => i.campaignFinished).length;

  return (
    <div className="targeting-tab">
      {/* Stats */}
      <div className="targeting-stats">
        <div className="targeting-stat card">
          <div className="card-body">
            <span className="targeting-stat-emoji">🚀</span>
            <span className="targeting-stat-value">{promotedCount}</span>
            <span className="targeting-stat-label">В таргете</span>
          </div>
        </div>
        <div className="targeting-stat card">
          <div className="card-body">
            <span className="targeting-stat-emoji">✅</span>
            <span className="targeting-stat-value">{finishedCount}</span>
            <span className="targeting-stat-label">Завершено</span>
          </div>
        </div>
        <div className="targeting-stat card">
          <div className="card-body">
            <span className="targeting-stat-emoji">⏳</span>
            <span className="targeting-stat-value">{Math.max(0, promotedCount - finishedCount)}</span>
            <span className="targeting-stat-label">Активно</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">📊 Управление рекламой</h3>
          <p className="ai-section-desc">
            Отмечайте публикации, запущенные в продвижение, вписывайте результаты и отмечайте завершение.
          </p>

          <div className="targeting-list">
            {syncedItems.map((item) => (
              <div
                key={item.id}
                className={`targeting-item ${item.campaignFinished ? 'targeting-item-finished' : ''}`}
              >
                <div className="targeting-item-header">
                  <span className="editing-num-badge">{item.id}</span>
                  <input
                    type="text"
                    className="input"
                    style={{ flex: 1 }}
                    placeholder={`Публикация #${item.id}`}
                    value={item.name || ''}
                    onChange={(e) => updateName(item.id, e.target.value)}
                  />
                  <div className="targeting-item-toggles">
                    <label className="magic-checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="magic-checkbox"
                        checked={item.isPromoted}
                        onChange={() => togglePromoted(item.id)}
                      />
                      <span className="magic-checkbox-label">В таргете</span>
                    </label>
                    <label className="magic-checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="magic-checkbox"
                        checked={item.campaignFinished}
                        onChange={() => toggleFinished(item.id)}
                        disabled={!item.isPromoted}
                      />
                      <span className="magic-checkbox-label">Завершено</span>
                    </label>
                  </div>
                </div>
                {item.isPromoted && (
                  <div className="targeting-results">
                    <textarea
                      className="input textarea"
                      placeholder="Результаты рекламы: охваты, клики, заявки..."
                      value={item.results}
                      onChange={(e) => updateResults(item.id, e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
