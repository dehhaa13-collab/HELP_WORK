/* ============================================
   useClients — React Query хук для работы с БД
   Берет на себя кеширование, автоповторы и Realtime
   ============================================ */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/supabase';
import type { Client, PipelineStage } from '../types';
import { useEffect, useCallback } from 'react';

// Маппинг: snake_case (БД) -> camelCase (фронтенд)
const mapDbToClient = (row: Record<string, unknown>): Client => ({
  id: row.id as string,
  name: row.name as string,
  instagram: row.instagram as string,
  pipelineStage: (row.pipeline_stage as PipelineStage) || 'new',
  meetingSummary: (row.meeting_summary as string) || undefined,
  workspaceData: typeof row.workspace_data === 'object' && row.workspace_data ? row.workspace_data as Record<string, any> : {},
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// ============================================
// FIX #6: Safe debounce with Map (replaces window pollution)
// FIX #1: beforeunload flush to prevent data loss
// ============================================
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingFlushData = new Map<string, Record<string, any>>();

/**
 * Flush all pending workspace saves to Supabase.
 * Uses fetch with keepalive: true so requests survive page unload.
 */
function flushAllPendingUpdates() {
  // Clear all debounce timers
  pendingTimers.forEach(timer => clearTimeout(timer));
  pendingTimers.clear();

  // Send any unsaved data via keepalive fetch
  pendingFlushData.forEach((workspaceData, clientId) => {
    try {
      fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ workspace_data: workspaceData }),
        keepalive: true, // Survives page unload
      }).catch(() => {});
    } catch { /* ignore */ }
  });
  pendingFlushData.clear();
}

// Register beforeunload once (module-level, runs on import)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAllPendingUpdates);
}

/**
 * Хук для получения всех клиентов из базы.
 * Он автоматически подписывается на изменения (Realtime).
 * FIX #2: handles Realtime disconnection + visibility change.
 */
export function useClients() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw new Error(`[Supabase] Ошибка загрузки: ${error.message}`);
      return (data || []).map(mapDbToClient);
    },
    staleTime: 30_000,          // 30s — don't refetch if data is fresh
    refetchOnWindowFocus: false, // Realtime + visibilitychange handles updates
  });

  useEffect(() => {
    // Realtime subscription with error handling
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      })
      .subscribe((status) => {
        // FIX #2: Handle channel errors (timeout, disconnect)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Channel ${status}, refetching data...`);
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
          }, 3000);
        }
      });

    // FIX #2: Refetch when tab becomes visible (handles laptop sleep/wake)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [queryClient]);

  return query;
}

/**
 * Хук для добавления клиента.
 */
export function useAddClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, instagram, comment }: { name: string; instagram: string; comment?: string }) => {
      const instagramFormatted = instagram.startsWith('@') ? instagram : `@${instagram}`;
      const insertData: Record<string, unknown> = {
        name,
        instagram: instagramFormatted,
        pipeline_stage: 'new',
      };
      if (comment && comment.trim()) {
        insertData.meeting_summary = comment.trim();
      }

      const { data, error } = await supabase
        .from('clients')
        .insert(insertData)
        .select()
        .single();

      if (error) throw new Error(`Не удалось добавить клиента: ${error.message}`);
      return mapDbToClient(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Хук для удаления клиента
 */
export function useRemoveClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw new Error(`Не удалось удалить клиента: ${error.message}`);

      // Clean up any pending updates for this client
      pendingTimers.forEach((timer, key) => {
        if (key === `ws_${id}`) {
          clearTimeout(timer);
          pendingTimers.delete(key);
        }
      });
      pendingFlushData.delete(id);

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Универсальный хук для обновления клиента
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.instagram !== undefined) dbUpdates.instagram = updates.instagram;
      if (updates.pipelineStage !== undefined) dbUpdates.pipeline_stage = updates.pipelineStage;
      if (updates.meetingSummary !== undefined) dbUpdates.meeting_summary = updates.meetingSummary;
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase.from('clients').update(dbUpdates).eq('id', id);
      if (error) throw new Error(`Не удалось обновить: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Хук для обновления Workspace Data с дебаунсом и оптимистичным UI.
 * FIX #1: Tracks pending data for beforeunload flush.
 * FIX #6: Uses Map instead of window[timerId].
 */
export function useUpdateWorkspaceData() {
  const queryClient = useQueryClient();

  return useCallback((id: string, key: string, data: any) => {
    // 1. Оптимистично обновляем кеш React Query (мгновенный UI)
    queryClient.setQueryData(['clients'], (oldClients: Client[] | undefined) => {
      if (!oldClients) return oldClients;
      return oldClients.map(c => {
        if (c.id === id) {
          return {
            ...c,
            workspaceData: { ...c.workspaceData, [key]: data }
          };
        }
        return c;
      });
    });

    // 2. Track latest data for beforeunload flush (FIX #1)
    const currentClients = queryClient.getQueryData<Client[]>(['clients']);
    const client = currentClients?.find(c => c.id === id);
    if (client) {
      pendingFlushData.set(id, client.workspaceData);
    }

    // 3. Debounced save using Map (FIX #6)
    const timerId = `ws_${id}`;
    const existingTimer = pendingTimers.get(timerId);
    if (existingTimer) clearTimeout(existingTimer);

    pendingTimers.set(timerId, setTimeout(async () => {
      pendingTimers.delete(timerId);

      const clients = queryClient.getQueryData<Client[]>(['clients']);
      const clientToUpdate = clients?.find(c => c.id === id);

      if (clientToUpdate) {
        await supabase
          .from('clients')
          .update({ workspace_data: clientToUpdate.workspaceData })
          .eq('id', id);

        // Successfully saved — remove from pending flush
        pendingFlushData.delete(id);
      }
    }, 1500));
  }, [queryClient]);
}
