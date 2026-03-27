/* ============================================
   Вкладка 5: Таргет / Аналитика
   Управление рекламой по каждой публикации
   ============================================ */

import { useState } from 'react';
import './TargetingTab.css';

interface Props {
  clientId: string;
}

interface TargetItem {
  id: number;
  isPromoted: boolean;
  results: string;
  campaignFinished: boolean;
}

export function TargetingTab({ clientId: _clientId }: Props) {
  const [items, setItems] = useState<TargetItem[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      isPromoted: false,
      results: '',
      campaignFinished: false,
    }))
  );

  const togglePromoted = (id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isPromoted: !item.isPromoted } : item
      )
    );
  };

  const toggleFinished = (id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, campaignFinished: !item.campaignFinished } : item
      )
    );
  };

  const updateResults = (id: number, results: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, results } : item
      )
    );
  };

  const promotedCount = items.filter((i) => i.isPromoted).length;
  const finishedCount = items.filter((i) => i.campaignFinished).length;

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
            <span className="targeting-stat-value">{promotedCount - finishedCount}</span>
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
            {items.map((item) => (
              <div
                key={item.id}
                className={`targeting-item ${item.campaignFinished ? 'targeting-item-finished' : ''}`}
              >
                <div className="targeting-item-header">
                  <span className="editing-num-badge">{item.id}</span>
                  <span className="targeting-pub-label">Публикация #{item.id}</span>
                  <div className="targeting-item-toggles">
                    <label className="editing-checkbox">
                      <input
                        type="checkbox"
                        checked={item.isPromoted}
                        onChange={() => togglePromoted(item.id)}
                      />
                      <span className="editing-checkbox-custom" />
                      <span className="editing-checkbox-label">В таргете</span>
                    </label>
                    <label className="editing-checkbox">
                      <input
                        type="checkbox"
                        checked={item.campaignFinished}
                        onChange={() => toggleFinished(item.id)}
                        disabled={!item.isPromoted}
                      />
                      <span className="editing-checkbox-custom" />
                      <span className="editing-checkbox-label">Завершено</span>
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
