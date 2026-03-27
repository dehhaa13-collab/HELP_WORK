/* ============================================
   Login Page — Страница авторизации
   ============================================ */

import { useState } from 'react';
import { useAuthStore, useToastStore } from '../../store';
import './LoginPage.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      addToast('warning', 'Заполните все поля', 'Введите логин и пароль для входа.');
      return;
    }

    setIsLoading(true);

    // Имитация задержки сети для реалистичности
    await new Promise((r) => setTimeout(r, 400));

    const success = login(username.trim(), password, rememberMe);
    setIsLoading(false);

    if (!success) {
      addToast('error', 'Ошибка входа', 'Неверный логин или пароль. Попробуйте снова.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">🎬</span>
          </div>
          <h1 className="login-title">Кабинет продюсера</h1>
          <p className="login-subtitle">Войдите для начала работы</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">Логин</label>
            <input
              id="login-username"
              className="input"
              type="text"
              placeholder="Введите логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Запомнить меня</span>
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-lg login-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
