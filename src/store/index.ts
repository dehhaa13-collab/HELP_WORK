/* ============================================
   Store — Глобальное состояние приложения (Zustand)
   Управление авторизацией, клиентами, тостами
   ============================================ */

import { create } from 'zustand';
import type { Client, PipelineStage, Toast, ToastType, User } from '../types';
import { PIPELINE_STAGES } from '../types';
import { supabase } from '../utils/supabase';

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
        return { user: parsed.user, isAuthenticated: true };
      }
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
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
    set({ user: null, isAuthenticated: false });
  },
}));

// === Client Store (Supabase + Realtime) ===
interface ClientState {
  clients: Client[];
  selectedClientId: string | null;
  isLoading: boolean;
  selectClient: (id: string | null) => void;
  addClient: (name: string, instagram: string) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  advanceStage: (id: string) => Promise<void>;
  setStage: (id: string, stage: PipelineStage) => Promise<void>;
  fetchClients: () => Promise<void>;
  initRealtime: () => void;
}

const generateId = () => crypto.randomUUID();

// localStorage как кэш для быстрого первого рендера
const CLIENTS_CACHE_KEY = 'helper_work_clients';
const getCachedClients = (): Client[] => {
  try {
    const saved = localStorage.getItem(CLIENTS_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
};
const cacheClients = (clients: Client[]) => {
  try { localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(clients)); } catch { /* ignore */ }
};

// Маппинг: snake_case (БД) -> camelCase (фронтенд)
const mapDbToClient = (row: Record<string, unknown>): Client => ({
  id: row.id as string,
  name: row.name as string,
  instagram: row.instagram as string,
  pipelineStage: (row.pipeline_stage as PipelineStage) || 'meeting',
  meetingSummary: (row.meeting_summary as string) || undefined,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const useClientStore = create<ClientState>((set, get) => ({
  clients: getCachedClients(),
  selectedClientId: null,
  isLoading: false,

  selectClient: (id) => {
    set({ selectedClientId: id });
  },

  fetchClients: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Supabase] Ошибка загрузки клиентов:', error);
      set({ isLoading: false });
      return;
    }

    const clients = (data || []).map(mapDbToClient);
    cacheClients(clients);
    set({ clients, isLoading: false });
  },

  addClient: async (name, instagram) => {
    const instagramFormatted = instagram.startsWith('@') ? instagram : `@${instagram}`;
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name,
        instagram: instagramFormatted,
        pipeline_stage: 'meeting',
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Ошибка добавления клиента:', error);
      throw new Error(`Не удалось добавить клиента: ${error.message}`);
    }

    const newClient = mapDbToClient(data);
    set((state) => {
      const updated = [...state.clients, newClient];
      cacheClients(updated);
      return { clients: updated };
    });
  },

  removeClient: async (id) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Supabase] Ошибка удаления клиента:', error);
      throw new Error(`Не удалось удалить клиента: ${error.message}`);
    }

    set((state) => {
      const updated = state.clients.filter((c) => c.id !== id);
      cacheClients(updated);
      return {
        clients: updated,
        selectedClientId: state.selectedClientId === id ? null : state.selectedClientId,
      };
    });
  },

  updateClient: async (id, updates) => {
    // Маппинг camelCase -> snake_case
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.instagram !== undefined) dbUpdates.instagram = updates.instagram;
    if (updates.pipelineStage !== undefined) dbUpdates.pipeline_stage = updates.pipelineStage;
    if (updates.meetingSummary !== undefined) dbUpdates.meeting_summary = updates.meetingSummary;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('clients')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('[Supabase] Ошибка обновления клиента:', error);
      throw new Error(`Не удалось обновить клиента: ${error.message}`);
    }

    set((state) => {
      const updated = state.clients.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      );
      cacheClients(updated);
      return { clients: updated };
    });
  },

  advanceStage: async (id) => {
    const client = get().clients.find((c) => c.id === id);
    if (!client) return;

    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === client.pipelineStage);
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const nextStage = PIPELINE_STAGES[currentIndex + 1].key;
      await get().updateClient(id, { pipelineStage: nextStage });
    }
  },

  setStage: async (id, stage) => {
    await get().updateClient(id, { pipelineStage: stage });
  },

  // Realtime подписка — синхронизация между пользователями
  initRealtime: () => {
    supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        // При любом изменении — перезагрузить все данные
        get().fetchClients();
      })
      .subscribe();
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

    // Автоматическое удаление через 10 секунд
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 10000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
