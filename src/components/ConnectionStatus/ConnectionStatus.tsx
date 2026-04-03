/* ============================================
   ConnectionStatus — Баннер при потере связи
   Показывает предупреждение когда нет интернета
   ============================================ */

import { useState, useEffect } from 'react';
import './ConnectionStatus.css';

export function ConnectionStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };
    const goOnline = () => {
      setIsOffline(false);
      // Показываем "Связь восстановлена" на 3 секунды
      setTimeout(() => setWasOffline(false), 3000);  
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="connection-banner connection-offline">
        <span className="connection-icon">📡</span>
        <span>Нет подключения к интернету. Данные сохранены локально.</span>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="connection-banner connection-restored">
        <span className="connection-icon">✅</span>
        <span>Связь восстановлена!</span>
      </div>
    );
  }

  return null;
}
