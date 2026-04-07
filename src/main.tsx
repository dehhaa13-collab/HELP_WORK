import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import './index.css'
import App from './App'

Sentry.init({
  dsn: "https://269fca538cdd5c1b009181ee7547d743@o4511146640670720.ingest.de.sentry.io/4511146654367824",
  integrations: [
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1, // 10% of transactions (saves Sentry quota)
  replaysSessionSampleRate: 0, 
  replaysOnErrorSampleRate: 1.0, 
});

// Создаём клиент React Query с настройками по умолчанию
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Не перезапрашивать при переключении окон, у нас Realtime
      retry: 2, // 2 повторные попытки при ошибке сети
      staleTime: 60_000, // 60s default — Realtime handles live updates, prevents stale cache
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary section="Приложение">
        <App />
      </ErrorBoundary>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
