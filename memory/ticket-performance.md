# Optimización de Performance: Apertura de Ticket y Caché de Catálogos

**Fecha:** 2026-09-21
**Archivos afectados:**
- `apps/api/src/routes/tickets.ts`
- `apps/web/src/components/CreateTicketModal.tsx`

## Diagnóstico del problema

Al abrir el popup del ticket (`CreateTicketModal` / `GET /tickets/:id`), la pegada tardaba más de 1.1s - 1.5s debido a:
1. **Invalidación cruzada de catálogos en el backend:** `clearTicketsCache()` contenía `catalogCache = null;`. Cada drag & drop, cambio de estado o auto-guardado en cualquier ticket destruía la caché de catálogos en memoria.
2. **Consultas sobredimensionadas y secuenciales en `GET /tickets/:id`:** El endpoint ejecutaba `prisma.ticket.findUnique` (~430ms) y a continuación `await getCatalogs()` (~560ms), el cual realizaba 5 `findMany` en cascada (`clients`, `users`, `ticketTypes`, `pilares`, `speakers`) en Supabase para resolver solo 1 ticket.
3. **Frontend sin staleTime:** `CreateTicketModal.tsx` ejecutaba `useQuery` de ticket con `staleTime: 0`, además de solicitar `clients`, `pilares` y `speakers` concurrentemente sin staleTime cada vez que se abría el modal.

## Solución implementada

1. **Persistencia de `catalogCache` en memoria:**
   - Se removió `catalogCache = null` de `clearTicketsCache()`. Los catálogos solo se invalidan cuando realmente se crean o editan (`clearCatalogRouteCache()` en `catalogs.ts`).
   - `clearTicketsCache(ticketId?: string)` ahora invalida puntualmente la caché de detalle del ticket afectado (`ticketDetailCache.delete(...)`), preservando las demás.
2. **Optimización de `GET /tickets/:id`:**
   - Se incluyeron directamente las relaciones necesarias en la consulta `findUnique` (`client`, `owner`, `reviewer`, `ticketType`, `pilar`, `speaker`).
   - La asignación de `assignees` ahora aprovecha `catalogCache.users` que reside en memoria RAM (costo: 0ms).
3. **Caché del lado del cliente en `CreateTicketModal.tsx`:**
   - Se configuró `staleTime: 30 * 1000` para `['ticket', ticket.id]`.
   - Se configuró `staleTime: 10 * 60 * 1000` para `clients` y `ticketTypes`.
   - Se configuró `staleTime: 5 * 60 * 1000` para `pilares` y `speakers`.
