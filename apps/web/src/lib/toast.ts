export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs: number;
  createdAt: number;
}

export interface EmitToastInput {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let activeToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();
const recentDedupeMap = new Map<string, number>();
const DEDUPE_WINDOW_MS = 1000;

function notifyListeners() {
  const snapshot = [...activeToasts];
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function emitToast(input: EmitToastInput): string | null {
  const type: ToastType = input.type || 'error';
  const title = input.title?.trim() || undefined;
  const message = (input.message || '').trim() || 'Ocurrió un error inesperado.';
  const durationMs = input.durationMs ?? 6000;

  const dedupeKey = `${type}:${title || ''}:${message}`;
  const now = Date.now();
  const lastTime = recentDedupeMap.get(dedupeKey);
  if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
    return null;
  }
  recentDedupeMap.set(dedupeKey, now);

  const id = `toast_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const item: ToastItem = {
    id,
    type,
    title,
    message,
    durationMs,
    createdAt: now,
  };

  activeToasts = [...activeToasts, item];
  notifyListeners();

  if (durationMs > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, durationMs);
  }

  return id;
}

export function dismissToast(id: string) {
  const next = activeToasts.filter((t) => t.id !== id);
  if (next.length !== activeToasts.length) {
    activeToasts = next;
    notifyListeners();
  }
}

export function clearAllToasts() {
  activeToasts = [];
  recentDedupeMap.clear();
  notifyListeners();
}

export function getActiveToasts(): ToastItem[] {
  return [...activeToasts];
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...activeToasts]);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyApiSaveError(endpoint: string, method: string, rawMessage?: string) {
  const upperMethod = (method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod)) {
    return;
  }
  if (endpoint.startsWith('/auth/logout') || endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register')) {
    return;
  }

  let title = 'Error al guardar los cambios';
  if (endpoint.includes('/attachments')) {
    title = 'No se pudo subir el archivo adjunto';
  } else if (endpoint.includes('/comments')) {
    title = upperMethod === 'DELETE' ? 'No se pudo eliminar el comentario' : 'No se pudo guardar el comentario';
  } else if (endpoint.startsWith('/tickets')) {
    title = upperMethod === 'DELETE' ? 'No se pudo eliminar el ticket' : 'No se pudo guardar el ticket';
  }

  const cleanMsg =
    rawMessage && rawMessage !== 'Request failed' && rawMessage !== 'Failed to fetch'
      ? rawMessage
      : 'Verificá tu conexión e intentá nuevamente.';

  emitToast({
    type: 'error',
    title,
    message: cleanMsg,
  });
}
