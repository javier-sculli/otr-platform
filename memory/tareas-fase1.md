# Tareas (HU Fase 1) — implementación y decisiones

**Fecha:** 2026-06-08 · Implementado y verificado en local (web 5173 + api 3001, DB Supabase).

## Qué es
Registrar **Tareas** (entregables no publicables: Deck, Estrategia, Reporte, Diseño puntual, Otro) reusando la infraestructura de `Ticket`. Una **Tarea = un `Ticket` cuyo `TicketType` tiene `kind = TAREA`**. Contenido = cualquier ticket con `kind = CONTENIDO` (o sin tipo).

## Modelo de datos
- Nuevo enum Prisma `TicketTypeKind { CONTENIDO, TAREA }` + campo `kind TicketTypeKind @default(CONTENIDO)` en `model TicketType` (`apps/api/prisma/schema.prisma`).
- Migración `20260608192747_add_ticket_type_kind`: crea enum, agrega columna (default CONTENIDO → todos los tipos existentes quedan Contenido) e **inserta 5 tipos TAREA** (`Deck, Estrategia, Reporte, Diseño puntual, Otro`) con `INSERT ... ON CONFLICT (name) DO UPDATE SET kind`.
- **Mismos estados** para Tarea y Contenido (las 11 columnas/status actuales). NO se tocó el enum de status. Decisión confirmada por Javi.
- **Estados reales en DB (Prisma):** `PENDIENTE, REDACCION, DISENO, EDICION, REVISION_INTERNA, CLIENTE, ESPERANDO_FEEDBACK, LISTO_PARA_PUBLICAR, PUBLICADO, CANCELADO, LISTO`. ⚠️ `packages/types`/`schemas` siguen con el enum viejo de 5 estados gruesos (drift histórico, no reconciliado en esta HU; el frontend hardcodea los estados reales).

## Backend
- `apps/api/src/routes/tickets.ts`: el `findMany` (GET /) ahora incluye `kind` en el select de `ticketType`. Create/update ya aceptaban `ticketTypeId`/`linkEntregable` vía `as any` (sin cambios).
- `apps/api/src/routes/catalogs.ts`: `GET /ticket-types` ordena por `[{ kind }, { name }]` (devuelve `kind` automáticamente).
- `packages/types`: enum `TicketTypeKind` + `kind` en interface `TicketType`. `packages/schemas`: `ticketTypeKindSchema` + `kind` en `createTicketTypeSchema`.

## Frontend (decisiones de UX) — modal reescrito al Figma exacto (2026-06-08)
- **`CreateTicketModal.tsx` rediseñado fiel al Figma Make (minimalista)**, tras pegar Javi los screenshots de ModalNuevo (Pieza/Tarea). Claves:
  - Header **blanco**, título **"Nuevo"** (o "Editar"), toggle **"Pieza" / "Tarea"** (no "Contenido"): pills outline, Pieza azul `#024fff`, Tarea verde `#00b87f`. Bloqueado en edición.
  - **Labels minimalistas**: `text-[10px] font-bold uppercase tracking-wide text-[#000033]/40` con ícono chico (era el origen de "letras raras": antes usaba labels bold grandes).
  - Layout **grid 2 columnas**: Nombre (full) → [Tipo | Cliente] → Brief/Descripción → [Fecha | Owner/Responsable] → type-specific.
  - **Pieza**: Vocero + Pilar (chips, solo si el cliente tiene; decisión de Javi: van en el popup de Pieza aunque el Figma no los mostraba) → Red(es) objetivo (`LinkedIn/Instagram/Twitter`, **3 redes**, no 5) → **RECURSOS** (link Drive, opcional, links[]). Botón "Crear pieza" azul + Sparkles.
  - **Tarea**: **NO** tiene Redes ni Recursos ni vocero/pilar ni link de entregable en creación. Botón "Crear tarea" verde + Check. Placeholder de nombre = "Nombre del pedido".
  - ⚠️ **El link de entregable/recursos es de Pieza (RECURSOS), NO de Tarea** — la primera versión lo tenía al revés y Javi lo marcó.
  - **Prioridad en AMBOS** (Pieza y Tarea), **abajo de todo**, a **media anchura** (`w-1/2`), con color por valor: Alta azul `#024fff`, Media verde `#00ff99`, Baja gris (mismos colores que las tarjetas del kanban).
  - **Estilos minimalistas**: bordes **1px** (`border`, no `border-2`) y claros (`#000033`/12); labels `text-[10px] uppercase /40`. Esto corrigió lo de "letras raras / popup pesado" que marcó Javi.
  - Footer: "Ver completo" (izq, deshabilitado en creación), "Cancelar", botón crear/Guardar. En edición se agregan secciones extra: Recursos completo (con adjuntos), Copy y Entregable visual (solo Pieza).
  - Verificado con `pnpm build` (web+api+packages OK) + typecheck limpio + browser.

## Fixes post-feedback de la contenidista (2026-06-08)
1. **Adjuntar archivos antes de crear**: el botón de adjuntar (paperclip) en RECURSOS ahora aparece también en creación de Pieza (antes solo en edición). Los adjuntos viven en `attachedFiles` (state) y se pasan a la redacción.
2. **Crear y redactar**: en creación de Pieza el botón primario es **"Crear y redactar"** (crea + navega a `/content/:id` pasando `attachedFiles` por `location.state` y `sessionStorage[ticket-files-:id]`). Hay un secundario **"Crear"** (crea y cierra, sin redactar). En edición de Pieza se agregó botón **"Redactar"** (guarda y va al workspace). Tarea sigue con solo "Crear tarea" (sin redacción, por diseño). Refactor: `submitTicket({redactar})` con `mutateAsync`; las mutaciones ya no auto-cierran.
3. **Blog/Newsletter/Reel son Contenido**: faltaban como `TicketType` → la contenidista usó Tarea para un blogpost y no pudo redactar. Migración `20260608200000_add_blog_newsletter_reel_types` inserta esos 3 tipos como `CONTENIDO` (idempotente). Aclaración de producto: blog/newsletter/reel = **Pieza** (se redactan); las Tareas no tienen redacción IA a propósito (entregables no publicables).
- **Badge de Tarea = pill navy sólido `bg-[#000033] text-white`** con ícono `ClipboardList` (dentro de la paleta). En `TicketCard` (BacklogPage) y en el header de `TicketDetallePage`.
- **Filtro segmentado `Todos / Contenido / Tareas`** en la barra de filtros de `BacklogPage` (`filtroTipo`, default TODOS; incluido en "Limpiar filtros"). `TAREA` ⇒ `kind==='TAREA'`; `CONTENIDO` ⇒ `kind!=='TAREA'`.
- `TicketDetallePage`: si `esTarea` (`ticketType?.kind==='TAREA'`) → "Brief"→"Descripción", oculta Copy + Notas audiovisual + ambos CTA "Redactar" (header + card Acciones del sidebar), "Entregable visual"→"Link del entregable".

## Fase 2 (NO implementado, pendiente de validar)
Rediseño de vistas del tablero: zoom consolidada/extendida, carriles por tipo/persona. Ver HU Fase 2.

## Nota de verificación
Login local es Google OAuth (no hay user/pass seed en Supabase). Para verificar en browser se minteó un JWT HS256 con `JWT_SECRET` (payload `{id,email,role}`) y se inyectó en `localStorage.token`. El ticket de prueba creado se borró vía API.
