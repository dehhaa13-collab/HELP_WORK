# 🔗 Карта зависимостей — HELPER WORK

> Этот файл описывает связи между компонентами проекта.
> **Правило:** Перед изменением любого файла — посмотри сюда, чтобы знать, что ещё может сломаться.

*Последнее обновление: 1 апреля 2026*

---

## 📊 Граф зависимостей (общий)

```
main.tsx
  └── App.tsx
        ├── store/index.ts (useAuthStore, useClientStore)
        ├── LoginPage.tsx
        │     ├── store/index.ts (useAuthStore, useToastStore)
        │     └── LoginPage.css
        ├── Dashboard.tsx
        │     ├── store/index.ts (useAuthStore, useClientStore, useToastStore)
        │     ├── types/index.ts (PIPELINE_STAGES, Client, PipelineStage)
        │     └── Dashboard.css
        ├── ClientWorkspace.tsx
        │     ├── store/index.ts (useClientStore)
        │     ├── types/index.ts (PIPELINE_STAGES)
        │     ├── ClientWorkspace.css
        │     └── [все 6 вкладок]
        └── ToastContainer.tsx
              ├── store/index.ts (useToastStore)
              └── ToastContainer.css
```

---

## 🔴 Критические узлы (изменил → проверь всё)

### `types/index.ts` — Центральные типы
Используется **везде**. Изменение типов ломает всё.

| Тип / Константа | Где используется |
|---|---|
| `Client` | `store/index.ts`, `Dashboard.tsx` |
| `PipelineStage` | `store/index.ts`, `Dashboard.tsx`, `ClientWorkspace.tsx` |
| `PIPELINE_STAGES` (массив 11 этапов) | `store/index.ts`, `Dashboard.tsx`, `ClientWorkspace.tsx` |
| `PostFormat`, `PublicationSlot` | `FormatsTab.tsx` |
| `TrafficLightStatus`, `ProfileAnalysis` | `AiAnalysisTab.tsx` |
| `Topic`, `Script` | `ScenariosTab.tsx` (локальные копии, не импорт!) |
| `EditingItem` | `EditingTab.tsx` (локальная копия, не импорт!) |
| `TargetingItem` | `TargetingTab.tsx` (локальная копия, не импорт!) |
| `FeedbackEntry` | `FeedbackTab.tsx` (локальная копия, не импорт!) |
| `Toast`, `ToastType` | `store/index.ts`, `ToastContainer.tsx` |
| `User` | `store/index.ts` |

> ⚠️ **Внимание:** Вкладки `Scenarios`, `Editing`, `Targeting`, `Feedback` определяют свои интерфейсы ЛОКАЛЬНО, а не импортируют из `types/`. Это значит типы дублируются. При изменении модели данных — обновлять и в `types/index.ts`, и в каждой вкладке.
>
> Все 6 вкладок используют `usePersistedState` для сохранения данных в `localStorage` (ключ `hw_{tab}_{clientId}`). Утилита: `utils/usePersistedState.ts`.

---

### `store/index.ts` — Zustand (3 стора)
Центральный хаб состояния. Используется почти всеми компонентами.

| Стор | Экспорт | Кто использует |
|---|---|---|
| `useAuthStore` | `user`, `isAuthenticated`, `login`, `logout` | `App.tsx`, `LoginPage.tsx`, `Dashboard.tsx` |
| `useClientStore` | `clients`, `selectedClientId`, `selectClient`, `addClient`, `removeClient`, `updateClient`, `advanceStage`, `setStage`, `fetchClients`, `initRealtime` | `App.tsx`, `Dashboard.tsx`, `ClientWorkspace.tsx` |
| `useToastStore` | `toasts`, `addToast`, `removeToast` | `LoginPage.tsx`, `Dashboard.tsx`, `ToastContainer.tsx`, `AiAnalysisTab.tsx`, `ScenariosTab.tsx`, `FeedbackTab.tsx` |

> ⚠️ Вкладки `FormatsTab`, `EditingTab`, `TargetingTab` **НЕ** используют сторы — данные только в local state.

---

### `utils/supabase.ts` — Подключение к БД

| Кто использует |
|---|
| `store/index.ts` (все CRUD-операции с клиентами + realtime) |

> Если меняешь Supabase URL/ключ → ломается **всё** приложение.

---

### `utils/geminiApi.ts` — AI-функции

| Экспорт | Кто использует |
|---|---|
| `fetchGeminiCompletion` | `AiAnalysisTab.tsx`, `ScenariosTab.tsx` |
| `getGeminiKey` | Только внутри `geminiApi.ts` |

> Если меняешь формат ответа Gemini / модель / ключ → проверь **обе** вкладки.

---

### `index.css` — Дизайн-система (глобальные стили)

Определяет CSS-классы, которые используются **напрямую** в компонентах (без импорта — глобально):

| CSS-класс | Где используется |
|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-lg` | Все компоненты |
| `.card`, `.card-body` | `Dashboard`, `ClientWorkspace`, все вкладки |
| `.input`, `.textarea` | `LoginPage`, `Dashboard` (модалка), `ScenariosTab`, `TargetingTab`, `FeedbackTab` |
| `.badge`, `.badge-primary`, `.badge-success` | `Dashboard.tsx` |
| `.toast`, `.toast-*` | `ToastContainer.tsx` |
| `.visually-hidden` | `AiAnalysisTab.tsx` (file input) |
| `.login-spinner` | `LoginPage.tsx`, `AiAnalysisTab.tsx`, `ScenariosTab.tsx` |
| CSS-переменные (`--color-*`, `--space-*`, etc.) | Все `.css` файлы компонентов |

> ⚠️ Переименование CSS-переменных или классов → **массовое** обновление. Искать по всему `src/`.

---

## 📱 Связи между страницами

```
LoginPage ──[login success]──→ Dashboard
Dashboard ──[selectClient(id)]──→ ClientWorkspace
ClientWorkspace ──[selectClient(null)]──→ Dashboard
Dashboard ──[logout]──→ LoginPage
```

Навигация управляется через **Zustand state**, не через React Router:
- `isAuthenticated` → показать Login или Dashboard
- `selectedClientId` → показать Dashboard или ClientWorkspace

---

## 🗂️ Связи внутри ClientWorkspace

```
ClientWorkspace.tsx (sidebar + tab router)
  ├── AiAnalysisTab    ← uses: geminiApi, useToastStore
  ├── FormatsTab       ← uses: types (PostFormat) — ИЗОЛИРОВАН
  ├── ScenariosTab     ← uses: geminiApi, useToastStore
  ├── EditingTab       ← ПОЛНОСТЬЮ ИЗОЛИРОВАН (no store, no utils)
  ├── TargetingTab     ← ПОЛНОСТЬЮ ИЗОЛИРОВАН
  └── FeedbackTab      ← uses: useToastStore
```

> Вкладки **не общаются** друг с другом. Каждая — изолированный модуль.
> Данные вкладок **не сохраняются** — теряются при переключении клиента.

---

## 🗄️ Supabase ↔ Фронтенд маппинг

Фронтенд использует camelCase, база — snake_case. Маппинг в `store/index.ts`:

| Frontend (Client) | Database (clients) |
|---|---|
| `id` | `id` |
| `name` | `name` |
| `instagram` | `instagram` |
| `pipelineStage` | `pipeline_stage` |
| `meetingSummary` | `meeting_summary` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

> ⚠️ При добавлении нового поля клиента — обновить:
> 1. Таблицу в Supabase
> 2. `types/index.ts` → интерфейс `Client`
> 3. `store/index.ts` → `mapDbToClient()` + `updateClient()` (camelCase↔snake_case)
> 4. Компоненты, которые отображают это поле

---

## 🧪 Чеклист: «Я изменил X, что проверить?»

### Изменил Pipeline (добавил/убрал этап)
- [ ] `types/index.ts` → `PipelineStage` тип + `PIPELINE_STAGES` массив
- [ ] `Dashboard.tsx` → pipeline legend + карточки
- [ ] `ClientWorkspace.tsx` → sidebar stage badge
- [ ] `store/index.ts` → `advanceStage`, `setStage`
- [ ] Supabase → проверить значения `pipeline_stage`

### Изменил модель Client (добавил поле)
- [ ] Supabase → добавить колонку
- [ ] `types/index.ts` → интерфейс `Client`
- [ ] `store/index.ts` → `mapDbToClient()`, `updateClient()`, `addClient()`
- [ ] `Dashboard.tsx` → если поле отображается на карточке
- [ ] `ClientWorkspace.tsx` → если поле в sidebar

### Изменил CSS-переменные
- [ ] `index.css` → сами переменные
- [ ] Проверить все `*.css` файлы компонентов (используют `var(--...)`)
- [ ] `AiAnalysisTab.tsx` → inline-стили с `statusColors`
- [ ] `FormatsTab.tsx` → inline-стили с `FORMAT_OPTIONS` colors

### Изменил Gemini API
- [ ] `utils/geminiApi.ts`
- [ ] `AiAnalysisTab.tsx` → промпт + парсинг ответа
- [ ] `ScenariosTab.tsx` → два промпта (темы + сценарии) + парсинг

### Изменил Supabase (URL / ключ / схему)
- [ ] `utils/supabase.ts`
- [ ] `store/index.ts` → все операции с `supabase.from('clients')`
- [ ] Realtime-подписка в `initRealtime()`

### Изменил Toast-систему
- [ ] `store/index.ts` → `useToastStore`
- [ ] `types/index.ts` → `Toast`, `ToastType`
- [ ] `ToastContainer.tsx` + `ToastContainer.css`
- [ ] `index.css` → `.toast-*` классы
- [ ] Все компоненты, вызывающие `addToast()`

### Изменил авторизацию
- [ ] `store/index.ts` → `useAuthStore`, массив `USERS`
- [ ] `LoginPage.tsx`
- [ ] `App.tsx` → условие `isAuthenticated`
- [ ] `Dashboard.tsx` → кнопка «Выйти», отображение `user.name`
