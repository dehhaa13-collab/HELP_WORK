/* ============================================
   Вкладка 4: Монтаж
   Чеклист: смонтировано, обложка, отдано клиенту
   ============================================ */

import { useState } from 'react';
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

export function EditingTab({ clientId: _clientId }: Props) {
  const [items, setItems] = useState<EditItem[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      editingDone: false,
      coverDone: false,
      deliveredToClient: false,
    }))
  );

  const toggleField = (id: number, field: keyof Omit<EditItem, 'id'>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: !item[field] } : item
      )
    );
  };

  const doneCount = items.filter((i) => i.editingDone && i.coverDone && i.deliveredToClient).length;

  return (
    <div className="editing-tab">
      <div className="card">
        <div className="card-body">
          <div className="editing-header">
            <div>
              <h3 className="ai-section-title">✂️ Статус монтажа</h3>
              <p className="ai-section-desc">
                Отмечайте прогресс по каждой публикации. Полностью готово: {doneCount} из {items.length}
              </p>
            </div>
            <div className="editing-progress-badge badge badge-primary">
              {doneCount}/{items.length}
            </div>
          </div>

          <div className="editing-table">
            <div className="editing-table-header">
              <span className="editing-col-num">#</span>
              <span className="editing-col-check">Монтаж</span>
              <span className="editing-col-check">Обложка</span>
              <span className="editing-col-check">Отдано</span>
            </div>
            {items.map((item) => {
              const allDone = item.editingDone && item.coverDone && item.deliveredToClient;
              return (
                <div key={item.id} className={`editing-table-row ${allDone ? 'editing-row-done' : ''}`}>
                  <span className="editing-col-num">
                    <span className="editing-num-badge">{item.id}</span>
                  </span>
                  <span className="editing-col-check">
                    <label className="editing-checkbox">
                      <input
                        type="checkbox"
                        checked={item.editingDone}
                        onChange={() => toggleField(item.id, 'editingDone')}
                      />
                      <span className="editing-checkbox-custom" />
                      <span className="editing-checkbox-label">Готово</span>
                    </label>
                  </span>
                  <span className="editing-col-check">
                    <label className="editing-checkbox">
                      <input
                        type="checkbox"
                        checked={item.coverDone}
                        onChange={() => toggleField(item.id, 'coverDone')}
                      />
                      <span className="editing-checkbox-custom" />
                      <span className="editing-checkbox-label">Готова</span>
                    </label>
                  </span>
                  <span className="editing-col-check">
                    <label className="editing-checkbox">
                      <input
                        type="checkbox"
                        checked={item.deliveredToClient}
                        onChange={() => toggleField(item.id, 'deliveredToClient')}
                      />
                      <span className="editing-checkbox-custom" />
                      <span className="editing-checkbox-label">Да</span>
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
