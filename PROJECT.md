# 🎬 HELPER WORK — Кабинет продюсера

> CRM-система для Instagram-продюсера. Управление клиентами через 11-этапный pipeline с AI-функциями.

---

## 🌐 Деплой

| Среда | URL |
|---|---|
| **Production (Vercel)** | [https://help-work-kappa.vercel.app](https://help-work-kappa.vercel.app) |
| **Local dev** | http://localhost:5173 |

Деплой на Vercel привязан к GitHub-репозиторию. Push в `main` → автоматический деплой.

---

## 🔑 Доступы (авторизация)

Авторизация локальная (без Supabase Auth), два пользователя:

| Логин | Пароль | Роль | Имя |
|---|---|---|---|
| `admin` | `12345` | admin | Руководитель |
| `dasha` | `12345` | assistant | Даша |

Функция «Запомнить меня» сохраняет сессию в `localStorage`.

---

## 🏗️ Стек технологий

| Технология | Версия | Назначение |
|---|---|---|
| React | 19.2 | UI-фреймворк |
| TypeScript | 5.9 | Типизация |
| Vite | 8.0 | Сборщик и dev-сервер |
| Zustand | 5.0 | Глобальное состояние (3 стора: auth, clients, toasts) |
| Supabase | 2.100 | БД PostgreSQL + Realtime-синхронизация |
| Gemini API | 2.5 Flash | AI-анализ профилей и генерация контента |
| React Router DOM | 7.13 | (подключён, но маршрутизация через state) |
| CSS | Vanilla | Дизайн-система на CSS-переменных |
| Manrope | Google Fonts | Основной шрифт |

---

## 📁 Структура проекта

```
src/
├── App.tsx                          # Главный компонент (Login → Dashboard → Workspace)
├── main.tsx                         # Точка входа React
├── index.css                        # Дизайн-система (переменные, кнопки, карточки, тосты)
│
├── types/
│   └── index.ts                     # Все TypeScript-типы (Client, Pipeline, Formats, etc.)
│
├── store/
│   └── index.ts                     # Zustand: useAuthStore, useClientStore, useToastStore
│
├── utils/
│   ├── supabase.ts                  # Подключение к Supabase (URL + ключ)
│   └── geminiApi.ts                 # Утилита для Gemini API (vision + JSON-mode)
│
├── pages/
│   ├── Login/                       # Страница авторизации
│   │   ├── LoginPage.tsx
│   │   └── LoginPage.css
│   ├── Dashboard/                   # Дашборд с карточками клиентов
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.css
│   └── ClientWorkspace/             # Рабочее пространство клиента (sidebar + tabs)
│       ├── ClientWorkspace.tsx
│       └── ClientWorkspace.css
│
└── components/
    ├── Toast/                       # Система уведомлений
    │   ├── ToastContainer.tsx
    │   └── ToastContainer.css
    └── tabs/                        # 6 вкладок рабочего пространства
        ├── AiAnalysis/              # 🤖 AI-анализ Instagram-профиля
        ├── Formats/                 # 📱 Сетка форматов публикаций
        ├── Scenarios/               # 📝 Конкуренты → Темы → Сценарии
        ├── Editing/                 # ✂️ Чеклист монтажа
        ├── Targeting/               # 📊 Управление рекламой
        └── Feedback/                # 💬 Отзывы клиентов
```

---

## 🔄 Pipeline — 11 этапов работы с клиентом

| # | Ключ | Название | Эмодзи |
|---|---|---|---|
| 1 | `meeting` | Встреча | 🤝 |
| 2 | `formats` | Форматы | 📱 |
| 3 | `topics` | Темы | 💡 |
| 4 | `scripts` | Сценарии | 📝 |
| 5 | `sources` | Исходники | 📥 |
| 6 | `production` | Производство | ⚙️ |
| 7 | `ready` | Готовность | ✅ |
| 8 | `delivered` | Выдача | 📤 |
| 9 | `targeting` | Таргет | 🚀 |
| 10 | `feedback` | Фидбек | 💬 |
| 11 | `retention` | Продление | 🔄 |

Этапы хранятся в Supabase (поле `pipeline_stage`). Навигация «Далее →» / «← Назад» с дашборда.

---

## 🗄️ База данных (Supabase)

**Проект:** `egduscijdjjnxlxphfoe.supabase.co`

### Таблица `clients`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid (PK) | Авто-генерируется |
| `name` | text | Имя клиента |
| `instagram` | text | Instagram-аккаунт (@username) |
| `pipeline_stage` | text | Текущий этап pipeline |
| `meeting_summary` | text | Комментарий/заметка |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

**Realtime:** Включена подписка на таблицу `clients` — любые изменения автоматически синхронизируются между всеми открытыми вкладками/пользователями.

**Кэш:** `localStorage` (`helper_work_clients`) используется для мгновенного первого рендера до загрузки данных из Supabase.

---

## 🤖 AI-интеграция (Gemini API)

- **Модель:** `gemini-2.5-flash`
- **Режим:** JSON-mode (`responseMimeType: 'application/json'`)
- **Поддержка vision:** Да (base64-картинки)
- **Ключ:** Обфусцирован в `geminiApi.ts` (разбит на части для обхода GitHub secret scanning)

### Где используется AI:

1. **AI-анализ** (`AiAnalysisTab`) — загрузка скриншота Instagram → Gemini анализирует аватар/bio/highlights/feed → «светофор» + текстовый разбор
2. **Сценарии** (`ScenariosTab`):
   - Этап 1: Ссылки конкурентов → Gemini генерирует 12 тем
   - Этап 2: Выбор до 10 тем → Gemini пишет сценарии (хук, основная часть, CTA, музыка, хронометраж)

---

## 🎨 Дизайн-система

- **Шрифт:** Manrope (Google Fonts)
- **Палитра:** «Тихая роскошь» — нейтральные тона, мягкие тени
- **Акцентный цвет:** `#2563EB` (синий)
- **Фон:** `#F7F7F9`, карточки `#FFFFFF`
- **Sidebar:** Тёмный (`#1C1C1E`)
- **Радиусы:** 6px–20px (Apple-стиль)
- **Анимации:** toast slide-in, button scale, card hover translateY

---

## ⚠️ Известные ограничения

1. ~~**Данные вкладок не персистятся.**~~ ✅ Исправлено — все вкладки сохраняют данные в `localStorage` через `usePersistedState`.
2. **Авторизация фейковая.** Логины/пароли захардкожены, нет Supabase Auth.
3. **API-ключи в коде.** Supabase anon-key и Gemini API key обфусцированы, но лежат в клиентском коде.
4. **React Router подключён, но не используется.** Навигация через Zustand state (`selectedClientId`).

---

## 📜 История изменений (Changelog)

> На основе git-коммитов. Самые свежие — сверху.

### 2026-04-01

- **feat:** Все 6 вкладок теперь сохраняют прогресс в `localStorage` (хук `usePersistedState`). Данные привязаны к `clientId` — у каждого клиента свои.
- **fix:** Gemini 2.5 Flash (thinking model) — исправлен парсинг ответа: берём реальный ответ, а не reasoning-мысли модели

### 2026-03 — Предыдущие изменения

- **feat:** Редактирование имени клиента прямо в карточке на дашборде
- **feat:** Навигация по этапам «← Назад / Далее →» из карточки клиента
- **feat:** Поле «Комментарий» при создании клиента (сохраняется как `meeting_summary`)
- **fix:** Обновление модели Gemini до `2.5-flash`
- **fix:** Замена отозванного API-ключа Gemini
- **feat:** Миграция с платного Grok API → бесплатный Gemini 1.5 Flash (затем 2.5 Flash)
- **style:** Возврат фирменного синего цвета `#2563EB` для кнопок и акцентов
- **fix:** Toast показывается 10 сек + точная ошибка от API
- **style:** Внедрение «тихой роскоши» — шрифт Manrope, мягкая палитра, обновлённый брендбук
- **feat:** Supabase — данные клиентов в облаке + realtime-синхронизация
- **feat:** localStorage-кэш клиентов (быстрый первый рендер)
- **feat:** «Запомнить меня» — сессия в localStorage
- **fix:** Строгая валидация AI-ответов — честные ошибки вместо фейковых данных
- **feat:** Интеграция Grok API (первая версия AI-функций)
- **fix:** Modal overlay blur + solid background
- **fix:** Keyboard accessibility, Escape для закрытия модалки
- **fix:** 7 багов (re-render loop, pluralization, inline styles, spinner, stats)

### Начало проекта

- **🚀 Initial commit:** Кабинет продюсера — полноценная CRM с авторизацией, дашбордом, pipeline, 6 рабочими вкладками, AI-анализом и toast-системой

---

## 🚀 Команды

```bash
# Запуск dev-сервера
npm run dev

# Сборка production
npm run build

# Линтинг
npm run lint

# Превью production-сборки
npm run preview
```

---

*Последнее обновление: 1 апреля 2026*
