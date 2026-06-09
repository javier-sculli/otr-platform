# Tickets de referencia — vincular contexto entre piezas (HU)

**Fecha:** 2026-06-09 · Implementado y verificado en local. HU `376617fc…`, tarea `37a617fc…`.

## Qué hace
Vincular hasta **3** tickets de referencia a una pieza (**vínculo vivo, no copia**) para reutilizar su contexto al redactar. Su título+brief+contenido se inyectan al prompt de la IA. Aplica a Contenido y Tareas.

## Modelo
- Relación **N:N self** en `Ticket` (Prisma): `references Ticket[] @relation("TicketReferences")` + `referencedBy Ticket[] @relation("TicketReferences")`. Join implícito `_TicketReferences`. Migración `20260609213645_add_ticket_references`.
- `packages/types`: `references?: Pick<Ticket,'id'|'title'|'status'>[]`. `packages/schemas`: `referenceIds: z.array(uuid).max(3).optional()` en updateTicket.

## Backend (`apps/api/src/routes`)
- `tickets.ts`: GET `/:id` y PATCH `/:id` incluyen `references` (id, title, status, ticketType). PATCH acepta `referenceIds` → `references: { set }`, con **defensa server**: dedup, excluye self, `slice(0,3)`. GET `/` lista acepta filtro `speakerId`.
- `ai.ts`: el `findUnique` incluye `references {title, objetivo, content}`; se pasa `referencias` a `buildSystemPrompt`, que arma `referenciasBlock` = `## Tickets de referencia (mismo cliente y vocero)` + instrucción de uso + por cada ref `### Referencia N: título / Brief / Contenido`. Insertado **después de Brand Kit/Vocero** (`voiceContext`), antes de lineamientos. Solo si hay refs con contenido.

## Frontend
- **`components/TicketsReferencia.tsx`** (nombre del componente del Figma): chips de refs vinculadas (título + link a `/piezas/:id` + quitar), botón "+ Agregar" → desplegable con buscador. Candidatos vía `api.getTickets({ clientId })` **filtrados client-side** por mismo vocero (cubre el caso sin vocero: ambos `null`), excluyendo self y ya-vinculadas. Tope 3 deshabilita "Agregar". Guarda con `api.updateTicket(id,{referenceIds})` + invalida `['ticket',id]` y `['tickets']`. Vínculo vivo (siempre lee del ticket).
- Integrado en **`TicketDetallePage.tsx`** (card en columna principal) y **`ContentPage.tsx`** (Redactar, debajo del BRIEF). El modal de creación NO lo incluye (el ticket aún no existe).

## Notas
- Filtro estricto cliente+vocero (incluye match de "sin vocero").
- Tope 3 y formato de prompt son de fase de calibración, ajustables.
- Figma: existe `TicketsReferencia.tsx` en el diseño Make pero el tooling no lee su código; se hizo con el estilo minimalista actual.
