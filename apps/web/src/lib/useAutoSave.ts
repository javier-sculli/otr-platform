import { useState, useRef, useEffect, useCallback } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface UseAutoSaveOptions<T> {
  onSave: (data: T) => Promise<unknown> | unknown;
  debounceMs?: number;
  onSuccess?: (result: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface UseAutoSaveReturn<T> {
  status: SaveStatus;
  save: (data: T, immediate?: boolean) => Promise<unknown> | void;
  flush: () => Promise<unknown>;
  cancel: () => void;
  isPending: boolean;
  hasPending: boolean;
}

/**
 * Standard auto-save hook with predictable debouncing, immediate flushing (blur/paste),
 * and safe cleanup on beforeunload / unmount.
 */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function mergePending<T>(prev: T | null, next: T): T {
  if (isPlainObject(prev) && isPlainObject(next)) {
    return { ...prev, ...next } as T;
  }
  return next;
}

export function useAutoSave<T>({
  onSave,
  debounceMs = 750,
  onSuccess,
  onError,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<T | null>(null);
  const hasPendingRef = useRef(false);
  const isSavingRef = useRef(false);
  const immediateQueuedRef = useRef(false);

  const onSaveRef = useRef(onSave);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSaveRef.current = onSave;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const performSave = useCallback(async (data: T): Promise<unknown> => {
    if (isSavingRef.current) {
      pendingDataRef.current = mergePending(pendingDataRef.current, data);
      hasPendingRef.current = true;
      immediateQueuedRef.current = true;
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    hasPendingRef.current = false;
    pendingDataRef.current = null;
    immediateQueuedRef.current = false;
    isSavingRef.current = true;
    setStatus('saving');

    try {
      const res = await onSaveRef.current(data);
      if (!hasPendingRef.current) {
        setStatus('saved');
      }
      onSuccessRef.current?.(res);
      return res;
    } catch (err) {
      console.error('AutoSave error:', err);
      setStatus('error');
      onErrorRef.current?.(err);
      throw err;
    } finally {
      isSavingRef.current = false;
      if (hasPendingRef.current && pendingDataRef.current !== null && (immediateQueuedRef.current || !timerRef.current)) {
        const nextToSave = pendingDataRef.current;
        await performSave(nextToSave);
      }
    }
  }, []);

  const save = useCallback(
    (data: T, immediate = false) => {
      const merged = mergePending(hasPendingRef.current ? pendingDataRef.current : null, data);
      pendingDataRef.current = merged;
      hasPendingRef.current = true;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (immediate) {
        if (isSavingRef.current) {
          immediateQueuedRef.current = true;
          return;
        }
        return performSave(merged);
      } else {
        setStatus(isSavingRef.current ? 'saving' : 'unsaved');
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (hasPendingRef.current && pendingDataRef.current !== null) {
            performSave(pendingDataRef.current);
          }
        }, debounceMs);
      }
    },
    [debounceMs, performSave]
  );

  const flush = useCallback(() => {
    if (hasPendingRef.current && pendingDataRef.current !== null) {
      return performSave(pendingDataRef.current);
    }
    return Promise.resolve();
  }, [performSave]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    hasPendingRef.current = false;
    pendingDataRef.current = null;
    immediateQueuedRef.current = false;
    setStatus('saved');
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasPendingRef.current && pendingDataRef.current !== null) {
        performSave(pendingDataRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (hasPendingRef.current && pendingDataRef.current !== null) {
        performSave(pendingDataRef.current);
      }
    };
  }, [performSave]);

  return {
    status,
    save,
    flush,
    cancel,
    isPending: status === 'saving',
    hasPending: hasPendingRef.current,
  };
}
