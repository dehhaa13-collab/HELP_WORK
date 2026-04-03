/* ============================================
   migrations — Версионирование localStorage данных
   Защищает от поломок при изменении структуры данных (добавление новых полей)
   ============================================ */

const CURRENT_VERSION = 2; // Версия всей базы localStorage для проекта

interface MigrationFn {
  version: number;
  migrate: (key: string, data: any) => any;
}

const migrations: MigrationFn[] = [
  {
    version: 2,
    // v1 → v2: добавлено поле "name" в TargetItem, нужно проставить дефолт (пустую строку) старым клиентам
    migrate: (key, data) => {
      // Ищем данные вкладки "Таргет" (они хранятся массивом TargetItem)
      if (key.startsWith('hw_targeting_') && Array.isArray(data)) {
        return data.map(item => ({
          ...item,
          name: item.name ?? '', // Если name нет, ставим пустую строку
        }));
      }
      return data;
    }
  },
  // Задел для v3
  // {
  //   version: 3,
  //   migrate: (key, data) => {
  //      if (key.startsWith('hw_formats_')) {
  //          data.newField = true;
  //      }
  //      return data;
  //   }
  // }
];

/**
 * Проверяет текущую версию данных и последовательно натравливает функции миграции,
 * пока не дойдет до CURRENT_VERSION.
 */
export function migrateData(key: string, rawData: any): any {
  if (rawData === null || rawData === undefined) return rawData;
  if (typeof rawData !== 'object') return rawData; // Строки и булеаны не мигрируем

  // Сохраняем версию в отдельный ключ с суффиксом __v
  const versionKey = `${key}__v`;
  const currentVerStr = localStorage.getItem(versionKey);
  const currentVer = currentVerStr ? Number(currentVerStr) : 1; // У всего старого default v1

  if (currentVer >= CURRENT_VERSION) {
    return rawData; // Миграция не требуется
  }

  let data = rawData;
  
  // Проходим по миграциям от текущей до актуальной
  for (const m of migrations) {
    if (m.version > currentVer) {
      try {
        data = m.migrate(key, data);
      } catch (err) {
        console.error(`[Миграция v${m.version}] Ошибка миграции ключа ${key}:`, err);
        // Если миграция упала, лучше вернуть дефолтные сырые данные, чем крашиться
      }
    }
  }

  try {
    // Сохраняем обновленные данные и новую версию сразу же назад
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(versionKey, String(CURRENT_VERSION));
    console.log(`[Storage] Мигрировал ключ ${key} до v${CURRENT_VERSION}`);
  } catch {
    // Игнорируем quota errors
  }

  return data;
}
