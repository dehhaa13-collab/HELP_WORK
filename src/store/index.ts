/* ============================================
   Store — Глобальное состояние приложения (Zustand)
   Управление авторизацией, клиентами, тостами
   ============================================ */

import { create } from 'zustand';
import type { Client, PipelineStage, Toast, ToastType, User } from '../types';
import { PIPELINE_STAGES } from '../types';

// === Auth Store ===
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const USERS: { username: string; password: string; user: User }[] = [
  { username: 'admin', password: '12345', user: { id: '1', name: 'Руководитель', role: 'admin' } },
  { username: 'dasha', password: '12345', user: { id: '2', name: 'Даша', role: 'assistant' } },
];

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (username: string, password: string) => {
    const found = USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (found) {
      set({ user: found.user, isAuthenticated: true });
      return true;
    }
    return false;
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

// === Client Store ===
interface ClientState {
  clients: Client[];
  selectedClientId: string | null;
  selectClient: (id: string | null) => void;
  addClient: (name: string, instagram: string) => void;
  removeClient: (id: string) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  advanceStage: (id: string) => void;
  setStage: (id: string, stage: PipelineStage) => void;
}

const generateId = () => crypto.randomUUID();

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  selectedClientId: null,

  selectClient: (id) => {
    set({ selectedClientId: id });
  },

  addClient: (name, instagram) => {
    const newClient: Client = {
      id: generateId(),
      name,
      instagram: instagram.startsWith('@') ? instagram : `@${instagram}`,
      pipelineStage: 'meeting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ clients: [...state.clients, newClient] }));
  },

  removeClient: (id) => {
    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
      selectedClientId: state.selectedClientId === id ? null : state.selectedClientId,
    }));
  },

  updateClient: (id, updates) => {
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },

  advanceStage: (id) => {
    const client = get().clients.find((c) => c.id === id);
    if (!client) return;

    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const nextStage = PIPELINE_STAGES[currentIndex + 1].key;
      get().updateClient(id, { pipelineStage: nextStage });
    }
  },

  setStage: (id, stage) => {
    get().updateClient(id, { pipelineStage: stage });
  },
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
    set((state) => ({ toasts: [...state.toasts, toast] }));

    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
