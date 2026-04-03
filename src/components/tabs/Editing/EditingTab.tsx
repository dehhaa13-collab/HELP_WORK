/* ============================================
   Вкладка 4: Монтаж
   Чеклист: смонтировано, обложка, отдано клиенту
   Синхронизация: количество строк из Форматов,
   названия публикаций из Таргета.
   ============================================ */

import { usePersistedState } from '../../../utils/usePersistedState';
import './EditingTab.css';

interface Props {
  clientId: string;
}

interface EditItem {
  id: number;
  editingDone: boolean;
  coverDone: boolean;
  deliveredToClient: boolean;
}

interface TargetItem {
  id: number;
  name: string;
}

export function EditingTab({ clientId }: Props) {
  // Читаем количество слотов из вкладки Форматы (source of truth)
  const [slotCount] = usePersistedState<number>(`hw_formats_count_${clientId}`, 10);
  
  // Читаем названия публикаций из вкладки Таргет (source of truth)
  const [targetItems] = usePersistedState<TargetItem[]>(`hw_targeting_${clientId}`, []);

  const [items, setItems] = usePersistedState<EditItem[]>(
    `hw_editing_${clientId}`,
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      editingDone: false,
      coverDone: false,
      deliveredToClient: false,
    }))
  );

  // Синхронизация количества строк с Форматами
  const syncedItems = (() => {
    if (items.length < slotCount) {
      // Добавить недостающие
      const extra = Array.from({ length: slotCount - items.length }, (_, i) => ({
        id: items.length + i + 1,
        editingDone: false,
        coverDone: false,
        deliveredToClient: false,
      }));
      return [...items, ...extra];
    }
    return items.slice(0, slotCount);
  })();

  const toggleField = (id: number, field: keyof Omit<EditItem, 'id'>) => {
    // Сначала убедимся что массив правильной длины
    const base = syncedItems.length !== items.length ? syncedItems : items;
    setItems(
      base.map((item) =>
        item.id === id ? { ...item, [field]: !item[field] } : item
      )
    );
  };

  // Получить название публикации из Таргета
  const getPubName = (id: number): string => {
    const target = targetItems.find(t => t.id === id);
    return target?.name || '';
  };

  const doneCount = syncedItems.filter((i) => i.editingDone && i.coverDone && i.deliveredToClient).length;

  return (
    <div className="editing-tab">
      <div className="card">
        <div className="card-body">
          <div className="editing-header">
            <div>
              <h3 className="ai-section-title">✂️ Статус монтажа</h3>
              <p className="ai-section-desc">
                Отмечайте прогресс по каждой публикации. Полностью готово: {doneCount} из {syncedItems.length}
              </p>
            </div>
            <div className="editing-progress-badge badge badge-primary">
              {doneCount}/{syncedItems.length}
            </div>
          </div>

          <div className="editing-table">
            <div className="editing-table-header">
              <span className="editing-col-num">#</span>
              <span className="editing-col-name">Публикация</span>
              <span className="editing-col-check">Монтаж</span>
              <span className="editing-col-check">Обложка</span>
              <span className="editing-col-check">Отдано</span>
            </div>
            {syncedItems.map((item) => {
              const allDone = item.editingDone && item.coverDone && item.deliveredToClient;
              const pubName = getPubName(item.id);
              return (
                <div key={item.id} className={`editing-table-row ${allDone ? 'editing-row-done' : ''}`}>
                  <span className="editing-col-num">
                    <span className="editing-num-badge">{item.id}</span>
                  </span>
                  <span className="editing-col-name editing-pub-name" title={pubName || `Публикация #${item.id}`}>
                    {pubName || <span className="editing-pub-placeholder">Публикация #{item.id}</span>}
                  </span>
                  <span className="editing-col-check">
                    <label className="magic-checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="magic-checkbox"
                        checked={item.editingDone}
                        onChange={() => toggleField(item.id, 'editingDone')}
                      />
                      <span className="magic-checkbox-label">Готово</span>
                    </label>
                  </span>
                  <span className="editing-col-check">
                    <label className="magic-checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="magic-checkbox"
                        checked={item.coverDone}
                        onChange={() => toggleField(item.id, 'coverDone')}
                      />
                      <span className="magic-checkbox-label">Готова</span>
                    </label>
                  </span>
                  <span className="editing-col-check">
                    <label className="magic-checkbox-wrapper">
                      <input
                        type="checkbox"
                        className="magic-checkbox"
                        checked={item.deliveredToClient}
                        onChange={() => toggleField(item.id, 'deliveredToClient')}
                      />
                      <span className="magic-checkbox-label">Да</span>
                    </label>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
