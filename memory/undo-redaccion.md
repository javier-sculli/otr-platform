# Deshacer en el módulo de redacción (ContentPage)

**Fecha:** 2026-06-12 · **Estado:** Implementado, pendiente de prueba manual por Javi

## Qué es
Botón "Deshacer" (↶, ícono `Undo2`) en el toolbar del editor de `ContentPage.tsx` (`/content/:ticketId`), junto al contador de caracteres. Restaura la versión anterior del contenido generado por IA del canal activo.

## Cómo funciona
- Estado `versionsPerCanal: Record<string, string[]>` — pila de versiones **por canal**, solo en memoria del cliente (se pierde al cerrar la pestaña; NO se persiste el historial en la base).
- En `callAI`, antes de aplicar `result.newContent`, se pushea el `contentText` actual a la pila del canal activo.
- `handleUndo`: pop de la pila del canal activo → restaura texto, charCount y `contentPerCanal`, y persiste el texto restaurado vía `api.updateTicket` (el server siempre tiene el contenido actual, nunca el historial).
- Botón deshabilitado si la pila del canal activo está vacía o `isAiLoading`.
- Permite deshacer múltiples niveles (pila, no última versión única).

## Decisiones
- **UI undo > comando de chat "deshacer"**: determinista (restaura texto exacto), instantáneo, gratis, descubrible. El comando por IA re-generaría algo parecido (el history del chat lleva summaries, no el contenido completo).
- **Per-canal porque el contenido es per-canal** (`contentPerCanal`): una pila global pegaría texto de un canal en otro al cambiar de tab.
- **No persistir historial de versiones**: decisión explícita de Javi (2026-06-12) — "no tiene sentido guardar todo eso por ahora". Si algún día sirve (ej. para Devant ver qué se fue generando), va como feature aparte.
- El undo NO toca el chat: el último mensaje queda y sigue viajando como contexto (juega a favor: la IA sabe qué no funcionó).
- Solo se snapshotea antes de generaciones de IA; las ediciones manuales no crean versiones (para eso está el Ctrl+Z nativo del textarea).
