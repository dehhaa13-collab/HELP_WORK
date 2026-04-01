import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react';
import './index.css'
import App from './App'

Sentry.init({
  dsn: "https://269fca538cdd5c1b009181ee7547d743@o4511146640670720.ingest.de.sentry.io/4511146654367824",
  integrations: [
    // Включаем запись сессий, чтобы видеть, куда кликала Даша на видео при ошибке
    Sentry.replayIntegration(),
  ],
  // Трейсинг
  tracesSampleRate: 1.0, 
  
  // Видео-реплеи (будет записывать сессию, только если произошла ошибка)
  replaysSessionSampleRate: 0, // Не записывать обычные сессии без ошибок
  replaysOnErrorSampleRate: 1.0, // Писать сессии со 100% вероятностью, если вылез баг
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
