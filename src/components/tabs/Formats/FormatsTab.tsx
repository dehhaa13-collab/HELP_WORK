/* ============================================
   Вкладка 2: Выбор форматов публикаций
   Instagram-сетка с выбором типа контента
   ============================================ */

import { useState } from 'react';
import type { PostFormat } from '../../../types';
import './FormatsTab.css';

interface Props {
  clientId: string;
}

interface Slot {
  id: number;
  format: PostFormat;
}

const FORMAT_OPTIONS: { value: PostFormat; label: string; emoji: string; color: string }[] = [
  { value: 'reels', label: 'Reels', emoji: '🎬', color: '#E1306C' },
  { value: 'post', label: 'Пост', emoji: '🖼️', color: '#2563EB' },
  { value: 'carousel', label: 'Карусель', emoji: '📑', color: '#7C3AED' },
];

export function FormatsTab({ clientId: _clientId }: Props) {
  const [slotCount, setSlotCount] = useState(10);
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({ id: i + 1, format: null }))
  );

  const handleSlotCountChange = (count: number) => {
    setSlotCount(count);
    setSlots((prev) => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) => ({
            id: prev.length + i + 1,
            format: null as PostFormat,
          })),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const cycleFormat = (slotId: number) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot;
        const formats: PostFormat[] = [null, 'reels', 'post', 'carousel'];
        const currentIndex = formats.indexOf(slot.format);
        return { ...slot, format: formats[(currentIndex + 1) % formats.length] };
      })
    );
  };

  const getFormatInfo = (format: PostFormat) => {
    return FORMAT_OPTIONS.find((f) => f.value === format);
  };

  const stats = {
    reels: slots.filter((s) => s.format === 'reels').length,
    post: slots.filter((s) => s.format === 'post').length,
    carousel: slots.filter((s) => s.format === 'carousel').length,
    empty: slots.filter((s) => s.format === null).length,
  };

  return (
    <div className="formats-tab">
      {/* Settings */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">⚙️ Настройки сетки</h3>
          <div className="formats-settings">
            <label className="login-label">Количество публикаций в пакете:</label>
            <div className="formats-count-btns">
              {[6, 8, 9, 10, 12, 15].map((n) => (
                <button
                  key={n}
                  className={`btn ${slotCount === n ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => handleSlotCountChange(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="formats-stats">
        {FORMAT_OPTIONS.map((f) => (
          <div key={f.value} className="formats-stat-item">
            <span className="formats-stat-emoji">{f.emoji}</span>
            <span className="formats-stat-label">{f.label}:</span>
            <span className="formats-stat-count" style={{ color: f.color }}>
              {stats[f.value as keyof typeof stats]}
            </span>
          </div>
        ))}
        <div className="formats-stat-item">
          <span className="formats-stat-emoji">⬜</span>
          <span className="formats-stat-label">Пусто:</span>
          <span className="formats-stat-count">{stats.empty}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="formats-grid-wrapper card">
        <div className="card-body">
          <h3 className="ai-section-title">📱 Сетка публикаций</h3>
          <p className="ai-section-desc">Нажмите на ячейку для выбора формата: Reels → Пост → Карусель → Пусто</p>
          <div className="formats-grid">
            {slots.map((slot) => {
              const info = getFormatInfo(slot.format);
              return (
                <div
                  key={slot.id}
                  className={`formats-cell ${slot.format ? `formats-cell-${slot.format}` : 'formats-cell-empty'}`}
                  onClick={() => cycleFormat(slot.id)}
                  role="button"
                  tabIndex={0}
                  style={info ? { borderColor: info.color } : undefined}
                >
                  <span className="formats-cell-number">{slot.id}</span>
                  {info ? (
                    <>
                      <span className="formats-cell-emoji">{info.emoji}</span>
                      <span className="formats-cell-label" style={{ color: info.color }}>{info.label}</span>
                    </>
                  ) : (
                    <span className="formats-cell-placeholder">Нажмите</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
