/* ============================================
   usePersistedState — useState + localStorage
   Данные сохраняются при переключении вкладок/клиентов
   ============================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { migrateData } from './migrations';

/**
 * Как useState, но автоматически сохраняет/загружает из localStorage.
 * При смене key (например, другой clientId) — данные загружаются для нового ключа.
 *
 * @param key — Уникальный ключ localStorage (обычно `hw_${tab}_${clientId}`)
 * @param defaultValue — Значение по умолчанию, если в localStorage ничего нет
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const defaultRef = useRef(defaultValue);

  const [value, setValueRaw] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return migrateData(key, parsed);
      }
    } catch { /* повреждённые данные — игнорируем */ }
    return defaultRef.current;
  });

  // При смене key (другой клиент) → загрузить данные для нового ключа
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        setValueRaw(migrateData(key, parsed));
      } else {
        setValueRaw(defaultRef.current);
      }
    } catch {
      setValueRaw(defaultRef.current);
    }
  }, [key]);

  // Обёртка setState → сохраняет и в React state, и в localStorage
  const setValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
    setValueRaw((prev) => {
      const next = action instanceof Function ? action(prev) : action;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* localStorage переполнен — молча игнорируем */ }
      return next;
    });
  }, [key]);

  return [value, setValue];
}
