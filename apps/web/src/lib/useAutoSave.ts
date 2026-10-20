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

  const onSaveRef = useRef(onSave);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSaveRef.current = onSave;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const performSave = useCallback(async (data: T) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    hasPendingRef.current = false;
    pendingDataRef.current = null;
    setStatus('saving');

    try {
      const res = await onSaveRef.current(data);
      setStatus('saved');
      onSuccessRef.current?.(res);
      return res;
    } catch (err) {
      console.error('AutoSave error:', err);
      setStatus('error');
      onErrorRef.current?.(err);
      throw err;
    }
  }, []);

  const save = useCallback(
    (data: T, immediate = false) => {
      pendingDataRef.current = data;
      hasPendingRef.current = true;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (immediate) {
        return performSave(data);
      } else {
        setStatus('unsaved');
        timerRef.current = setTimeout(() => {
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
