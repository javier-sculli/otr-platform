import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with saved status and not pending', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ onSave, debounceMs: 500 }));

    expect(result.current.status).toBe('saved');
    expect(result.current.isPending).toBe(false);
    expect(result.current.hasPending).toBe(false);
  });

  it('debounces save calls and calls onSave after debounceMs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ onSave, debounceMs: 500 }));

    act(() => {
      result.current.save({ title: 'Primer cambio' });
    });

    expect(result.current.status).toBe('unsaved');
    expect(onSave).not.toHaveBeenCalled();

    // Fast-forward partially
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onSave).not.toHaveBeenCalled();

    // Add another change before debounce fires
    act(() => {
      result.current.save({ title: 'Segundo cambio' });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ title: 'Segundo cambio' });
  });

  it('saves immediately when immediate flag is true', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAutoSave({ onSave, debounceMs: 500 }));

    await act(async () => {
      await result.current.save({ status: 'LISTO' }, true);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ status: 'LISTO' });
    expect(result.current.status).toBe('saved');
  });

  it('flush executes pending save immediately', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAutoSave({ onSave, debounceMs: 500 }));

    act(() => {
      result.current.save({ objetivo: 'Nuevo brief' });
    });

    expect(result.current.status).toBe('unsaved');
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ objetivo: 'Nuevo brief' });
    expect(result.current.status).toBe('saved');
  });

  it('flushes pending save on unmount', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutoSave({ onSave, debounceMs: 500 }));

    act(() => {
      result.current.save({ content: 'Texto antes de cerrar' });
    });

    expect(onSave).not.toHaveBeenCalled();

    unmount();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ content: 'Texto antes de cerrar' });
  });

  it('handles save errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    const onError = vi.fn();
    const { result } = renderHook(() => useAutoSave({ onSave, onError, debounceMs: 500 }));

    await act(async () => {
      try {
        await result.current.save({ field: 'valor' }, true);
      } catch {}
    });

    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('merges pending object patches when an immediate save follows a debounced save', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAutoSave<Record<string, unknown>>({ onSave, debounceMs: 500 }));

    act(() => {
      result.current.save({ title: 'Título editado' }, false);
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.save({ status: 'REDACCION' }, true);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      title: 'Título editado',
      status: 'REDACCION',
    });
  });

  it('queues concurrent immediate saves sequentially using in-flight mutex without dropping patches', async () => {
    let resolveFirstSave: (val: any) => void;
    const firstSavePromise = new Promise(resolve => {
      resolveFirstSave = resolve;
    });

    const onSave = vi.fn()
      .mockImplementationOnce(() => firstSavePromise)
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useAutoSave<Record<string, unknown>>({ onSave, debounceMs: 500 }));

    // Start first immediate save (e.g. blur on input)
    let p1: any;
    act(() => {
      p1 = result.current.save({ brief: 'Brief modificado' }, true);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ brief: 'Brief modificado' });

    // While first save is still in flight, trigger second immediate save (e.g. click "Pasar a Redacción")
    let p2: any;
    act(() => {
      p2 = result.current.save({ status: 'REDACCION' }, true);
    });

    // Second save should NOT have fired yet because first save is in flight
    expect(onSave).toHaveBeenCalledTimes(1);

    // Now resolve first save
    await act(async () => {
      resolveFirstSave!({ ok: true });
      await p1;
      await p2;
    });

    // Second save should have executed sequentially with the status patch
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith({ status: 'REDACCION' });
  });
});
