/* ============================================
   useClients — React Query хук для работы с БД
   Берет на себя кеширование, автоповторы и Realtime
   ============================================ */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import type { Client, PipelineStage } from '../types';
import { useEffect, useCallback } from 'react';

// Маппинг: snake_case (БД) -> camelCase (фронтенд)
const mapDbToClient = (row: Record<string, unknown>): Client => ({
  id: row.id as string,
  name: row.name as string,
  instagram: row.instagram as string,
  pipelineStage: (row.pipeline_stage as PipelineStage) || 'meeting',
  meetingSummary: (row.meeting_summary as string) || undefined,
  workspaceData: typeof row.workspace_data === 'object' && row.workspace_data ? row.workspace_data as Record<string, any> : {},
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

/**
 * Хук для получения всех клиентов из базы.
 * Он автоматически подписывается на изменения (Realtime).
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
    refetchOnWindowFocus: false, // Realtime subscription handles live updates
  });

  // Инициализация Realtime подписки (один раз на клиенте)
  useEffect(() => {
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        // Делаем invalidate, чтобы React Query сам скачал обновленные данные
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        pipeline_stage: 'meeting',
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
      // Инвалидация обновит список
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
 * Хук для обновления Workspace Data с локальным Дебаунсом и Оптимистичным UI.
 * Возвращает функцию, которую можно вызывать на каждое нажатие клавиши.
 */
export function useUpdateWorkspaceData() {
  const queryClient = useQueryClient();

  // Мемоизированная функция — стабильная ссылка, не пересоздается на каждом рендере
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

    // 2. Дебаунс сети
    const timerId = `workspaceUpdateTimer_${id}`;
    if ((window as any)[timerId]) clearTimeout((window as any)[timerId]);
    
    (window as any)[timerId] = setTimeout(async () => {
      const currentClients = queryClient.getQueryData<Client[]>(['clients']);
      const clientToUpdate = currentClients?.find(c => c.id === id);
      
      if (clientToUpdate) {
        await supabase
          .from('clients')
          .update({ workspace_data: clientToUpdate.workspaceData })
          .eq('id', id);
      }
    }, 1500);
  }, [queryClient]);
}
