/* ============================================
   usePersistedState — useState + localStorage
   Данные сохраняются при переключении вкладок/клиентов
   ============================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { migrateData } from './migrations';
import { useClientStore } from '../store';

/**
 * Раньше: LocalStorage State
 * ТЕПЕРЬ: Облачный State (Multiplayer)
 * Автоматически сохраняет и загружает данные из `workspace_data` Supabase.
 * При потере интернета продолжает работать с localStorage.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const defaultRef = useRef(defaultValue);

  // Подключаемся к глобальному стору Supabase
  const clients = useClientStore((s) => s.clients);
  const selectedClientId = useClientStore((s) => s.selectedClientId);
  const updateWorkspaceData = useClientStore((s) => s.updateWorkspaceData);

  const client = clients.find((c) => c.id === selectedClientId);
  const cloudValue = client?.workspaceData?.[key];

  // Инициализация значения при загрузке компонента
  const [value, setValueRaw] = useState<T>(() => {
    // 1. Пробуем облако
    if (cloudValue !== undefined) {
      return migrateData(key, cloudValue);
    }
    // 2. Фоллбек на локальное хранилище (оффлайн режим или до первой синхронизации)
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return migrateData(key, JSON.parse(saved));
      }
    } catch { /* игнор */ }
    return defaultRef.current;
  });

  // Синхронизация с облаком и обработка смены ключа (клиента)
  useEffect(() => {
    let nextVal: T;

    if (cloudValue !== undefined) {
      nextVal = migrateData(key, cloudValue);
    } else {
      try {
        const saved = localStorage.getItem(key);
        nextVal = saved !== null ? migrateData(key, JSON.parse(saved)) : defaultRef.current;
      } catch {
        nextVal = defaultRef.current;
      }
    }

    const nextValStr = JSON.stringify(nextVal);
    // Обновляем локальный стейт только если он реально отличается от облачного (избегаем лупов)
    setValueRaw((currentVal) => (JSON.stringify(currentVal) !== nextValStr ? nextVal : currentVal));
  }, [key, cloudValue]);

  // Обёртка setState → сохраняет в React state, localStorage И в Supabase
  const setValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
    setValueRaw((prev) => {
      const next = action instanceof Function ? action(prev) : action;
      
      // Локальный кеш для оффлайна
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { }

      // Мультиплеер (Облако) - только если выбран клиент
      if (selectedClientId) {
        // Мы вызываем это напрямую, внутри store встроен дебаунс (чтобы не убить БД при быстром наборе текста)
        updateWorkspaceData(selectedClientId, key, next);
      }

      return next;
    });
  }, [key, selectedClientId, updateWorkspaceData]);

  return [value, setValue];
}
