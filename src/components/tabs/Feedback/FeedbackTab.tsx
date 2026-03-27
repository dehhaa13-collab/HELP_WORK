/* ============================================
   Вкладка 6: Отзывы и пожелания
   Фиксация фидбека от клиента
   ============================================ */

import { useState } from 'react';
import { useToastStore } from '../../../store';
import './FeedbackTab.css';

interface Props {
  clientId: string;
}

interface FeedbackEntry {
  id: string;
  text: string;
  createdAt: string;
}

export function FeedbackTab({ clientId: _clientId }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');

  const handleAdd = () => {
    if (!newEntry.trim()) {
      addToast('warning', 'Пустой отзыв', 'Напишите текст отзыва или пожелания.');
      return;
    }

    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      text: newEntry.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [entry, ...prev]);
    setNewEntry('');
    addToast('success', 'Отзыв сохранён', 'Комментарий клиента успешно добавлен.');
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="feedback-tab">
      {/* Add */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">💬 Новый отзыв / пожелание</h3>
          <p className="ai-section-desc">
            Запишите комментарии, пожелания или отзывы клиента.
          </p>
          <textarea
            className="input textarea"
            placeholder="Клиент просит больше Reels, хочет изменить стиль обложек..."
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            rows={4}
          />
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            style={{ marginTop: '0.75rem' }}
          >
            💾 Сохранить
          </button>
        </div>
      </div>

      {/* List */}
      {entries.length > 0 && (
        <div className="feedback-list">
          <h3 className="ai-section-title">📋 История отзывов ({entries.length})</h3>
          {entries.map((entry) => (
            <div key={entry.id} className="card feedback-entry">
              <div className="card-body">
                <div className="feedback-entry-header">
                  <span className="feedback-date">{formatDate(entry.createdAt)}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(entry.id)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
                <p className="feedback-text">{entry.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <div className="feedback-empty">
          <span className="feedback-empty-icon">💬</span>
          <p>Пока нет отзывов. Добавьте первый комментарий от клиента.</p>
        </div>
      )}
    </div>
  );
}
