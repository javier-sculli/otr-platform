/**
 * Escritura/lectura de sessionStorage que nunca rompe la pantalla.
 *
 * Bug (2026-11-18): tickets con un PDF de ~6 MB en "Referencias" no abrían la vista expandida.
 * sessionStorage admite ~5 MB por origen; setItem tiraba QuotaExceededError dentro de un
 * useEffect y React desmontaba toda la página. Estas copias son sólo un respaldo local: si no
 * entran, se descartan y la app sigue usando lo que viene del servidor.
 */
export function safeSessionSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    try {
      // No dejar una copia vieja que después se lea como si fuera la actual
      sessionStorage.removeItem(key);
    } catch {
      // storage bloqueado: nada que hacer
    }
    return false;
  }
}

export function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
