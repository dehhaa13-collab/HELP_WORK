/* ============================================
   usePersistedState — useState + Cloud Sync
   OPTIMIZED: direct cache reads instead of N
   separate useClients() subscriptions.
   ============================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { migrateData } from './migrations';
import { useClientStore } from '../store';
import { useUpdateWorkspaceData } from '../hooks/useClients';
import type { Client } from '../types';

export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const defaultRef = useRef(defaultValue);
  const queryClient = useQueryClient();
  const selectedClientId = useClientStore((s) => s.selectedClientId);

  // Stable ref for update function
  const updateWorkspaceData = useUpdateWorkspaceData();
  const updateRef = useRef(updateWorkspaceData);
  updateRef.current = updateWorkspaceData;

  // Read cloud value directly from cache — NO subscription!
  const readCloudValue = useCallback((): any => {
    if (!selectedClientId) return undefined;
    const clients = queryClient.getQueryData<Client[]>(['clients']);
    if (!clients) return undefined;
    const client = clients.find((c: Client) => c.id === selectedClientId);
    return client?.workspaceData?.[key];
  }, [queryClient, selectedClientId, key]);

  // Initialize from cloud → localStorage → default
  const [value, setValueRaw] = useState<T>(() => {
    const cv = readCloudValue();
    if (cv !== undefined) return migrateData(key, cv);
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return migrateData(key, JSON.parse(saved));
    } catch { /* ignore */ }
    return defaultRef.current;
  });

  // Track last known cloud string to skip echo updates
  const prevCloudStrRef = useRef<string>('');

  // Lightweight cache subscription — only reacts to 'clients' changes for THIS key
  useEffect(() => {
    const initialCV = readCloudValue();
    if (initialCV !== undefined) {
      const initialStr = JSON.stringify(initialCV);
      prevCloudStrRef.current = initialStr;
      const migrated = migrateData(key, initialCV);
      const migratedStr = JSON.stringify(migrated);
      setValueRaw(current => JSON.stringify(current) !== migratedStr ? migrated : current);
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query || event.query.queryKey[0] !== 'clients') return;

      const cv = readCloudValue();
      const cvStr = cv !== undefined ? JSON.stringify(cv) : '';

      if (cvStr && cvStr !== prevCloudStrRef.current) {
        prevCloudStrRef.current = cvStr;
        const migrated = migrateData(key, cv);
        const migratedStr = JSON.stringify(migrated);
        setValueRaw(current => JSON.stringify(current) !== migratedStr ? migrated : current);
      }
    });

    return unsubscribe;
  }, [key, readCloudValue, queryClient]);

  // Stable refs for setter
  const selectedClientIdRef = useRef(selectedClientId);
  selectedClientIdRef.current = selectedClientId;
  const keyRef = useRef(key);
  keyRef.current = key;

  // Setter: local state → localStorage → Supabase (debounced)
  const setValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
    setValueRaw((prev) => {
      const next = action instanceof Function ? action(prev) : action;

      try { localStorage.setItem(keyRef.current, JSON.stringify(next)); } catch { /* quota */ }

      // Update ref BEFORE triggering subscription to prevent echo
      prevCloudStrRef.current = JSON.stringify(next);

      const cid = selectedClientIdRef.current;
      if (cid) {
        updateRef.current(cid, keyRef.current, next);
      }

      return next;
    });
  }, []); // Fully stable — uses refs

  return [value, setValue];
}
