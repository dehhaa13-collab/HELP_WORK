/* ============================================
   Store — Глобальное состояние приложения (Zustand)
   Управление авторизацией, клиентами, тостами
   ============================================ */

import { create } from 'zustand';
import * as Sentry from '@sentry/react';
import type { Toast, ToastType, User } from '../types';

const generateId = () => crypto.randomUUID();

// === Auth Store ===
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe: boolean) => boolean;
  logout: () => void;
}

const USERS: { username: string; password: string; user: User }[] = [
  { username: 'admin', password: '12345', user: { id: '1', name: 'Руководитель', role: 'admin' } },
  { username: 'dasha', password: '12345', user: { id: '2', name: 'Даша', role: 'assistant' } },
];

const AUTH_STORAGE_KEY = 'helper_work_auth';

// Восстановить сессию из localStorage при загрузке
const getSavedAuth = (): { user: User; isAuthenticated: boolean } | null => {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.user && parsed.isAuthenticated) {
        // Связываем сессию с Sentry при восстановлении входа
        Sentry.setUser({ id: parsed.user.id, username: parsed.user.name, role: parsed.user.role });
        return { user: parsed.user, isAuthenticated: true };
      }
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  // Убираем юзера из Sentry если не залогинен
  Sentry.setUser(null);
  return null;
};

const savedAuth = getSavedAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: savedAuth?.user ?? null,
  isAuthenticated: savedAuth?.isAuthenticated ?? false,
  login: (username: string, password: string, rememberMe: boolean) => {
    const found = USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (found) {
      set({ user: found.user, isAuthenticated: true });
      
      // Отправляем данные в Sentry, чтобы знать, что ошибка случилась именно у Даши
      Sentry.setUser({ id: found.user.id, username: found.user.name, role: found.user.role });

      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: found.user, isAuthenticated: true }));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    Sentry.setUser(null);
    set({ user: null, isAuthenticated: false });
  },
}));

// === Client Store (Только UI стейт: какой клиент сейчас открыт) ===
interface ClientState {
  selectedClientId: string | null;
  selectClient: (id: string | null) => void;
}

export const useClientStore = create<ClientState>((set) => ({
  selectedClientId: null,
  selectClient: (id) => set({ selectedClientId: id }),
}));

// === Toast Store (Система уведомлений об ошибках) ===
interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, title, message) => {
    const id = generateId();
    const toast: Toast = { id, type, title, message };
    set((state) => {
      const updated = [...state.toasts, toast];
      // Keep only last 5 toasts to prevent UI overflow
      return { toasts: updated.slice(-5) };
    });

    // Если всплывает красная ошибка, шлем её в Sentry (так как код её уже перехватил)
    if (type === 'error') {
      Sentry.captureMessage(`[Toast Error] ${title}: ${message}`, 'error');
    }

    // Автоматическое удаление через 10 секунд
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 10000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
