import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeSessionGet, safeSessionSet } from '../safeStorage';

// Bug (2026-11-18): tickets con un PDF de ~6 MB en Referencias no abrían la vista expandida
// porque sessionStorage.setItem tiraba QuotaExceededError y rompía el render.

function fakeStorage(maxChars: number) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (v.length > maxChars) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe('safeSessionSet / safeSessionGet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda normalmente cuando entra', () => {
    const storage = fakeStorage(100);
    vi.stubGlobal('sessionStorage', storage);
    expect(safeSessionSet('k', 'chico')).toBe(true);
    expect(safeSessionGet('k')).toBe('chico');
  });

  it('con un archivo que excede la cuota NO tira error y descarta la copia vieja', () => {
    const storage = fakeStorage(100);
    vi.stubGlobal('sessionStorage', storage);
    safeSessionSet('ticket-files-1', 'copia vieja');

    const pdfEnorme = JSON.stringify([{ url: 'data:application/pdf;base64,' + 'A'.repeat(500) }]);
    expect(() => safeSessionSet('ticket-files-1', pdfEnorme)).not.toThrow();
    expect(safeSessionSet('ticket-files-1', pdfEnorme)).toBe(false);
    expect(safeSessionGet('ticket-files-1')).toBeNull();
  });

  it('si el storage está bloqueado, leer devuelve null en vez de romper', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(safeSessionGet('k')).toBeNull();
  });
});
