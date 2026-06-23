# Backlog de Prensa (HU Fase 2)

**Estado:** ✅ Completamente implementado (Vistas, controles de Agrupación/Densidad y diseño de tarjetas violetas). Typechecks y Builds OK. Migración de base de datos verificada y aplicada.

**Fecha:** 2026-06-23

## Qué se hizo
Pestaña "Prensa" dedicada (`/prensa`) con soporte para controles de visualización de Figma:
- **Nomenclatura General Status:** Se renombró técnicamente `MacroEstado` a `GeneralStatus` en frontend y tipos.
- **Agrupación y Densidad:** Implementación de controles interactivos para alternar entre agrupaciones por **Estado** o **Cliente**, y densidades de vista **Compacta** (4 columnas de GeneralStatus con sub-secciones internas de subestados) o **Expandida** (9 columnas planas side-by-side de subestados).
- **Diseño Violeta de Figma:** Tarjetas con línea izquierda violeta (`#7C3AED`), píldora violeta de subtipo de Prensa, avatar violeta y detalle de *Gestión-pitch* (Medio/Periodista).
- **Drag & Drop:** Configurado para funcionar dinámicamente en las 4 combinaciones del tablero.
- **Transparencia en Contenido:** El backlog de Contenido mantiene sus 11 columnas visuales intactas de forma retrocompatible.

## Modelo (decisiones)
- `Ticket.area` (enum `TicketArea`: CONTENIDO|PRENSA, default CONTENIDO). Filtro de área = Prensa no ve Contenido.
- Dos niveles: `macroEstado` (BACKLOG·EN_PROGRESO·EN_REVISION·FINALIZADO, columnas) + `subEstado` (9 de Prensa). **macroEstado se deriva del subEstado y se persiste** (backend, mapa inline en `routes/tickets.ts`).
- Subestados Prensa: STAND_BY/PENDIENTE (Backlog), EN_CURSO (En progreso), REV_SANTI/REV_MANU/ENVIADO_CLIENTE (En revisión), A_PUBLICAR/LISTO/CANCELADO (Finalizado). Nuevo arranca en PENDIENTE.
- Tipos de Prensa = `TicketType.kind = PRENSA` (3er kind). Sembrados con `prisma/seed-prensa.ts` (idempotente). Tipo `Gestión-pitch` habilita campos `medio`/`periodista`/`estadoRespuesta` (enum ENVIADO/RESPONDIDO/SIN_RESPUESTA) — reemplaza Excel paralelo.

## Archivos clave
- `apps/api/prisma/schema.prisma` — enums TicketArea/MacroEstado/SubEstado/EstadoRespuesta + PRENSA en TicketTypeKind + columnas en Ticket + índice `[area, macroEstado]`.
- `apps/api/prisma/migrations/20260623120000_add_prensa_backlog/migration.sql` — DDL a mano. **Aplicar con `prisma migrate deploy` ANTES de desplegar el código** (el client ya espera las columnas). DDL y data separados por el caveat de Postgres (no usar enum value nuevo en la misma tx que el ADD VALUE).
- `apps/api/prisma/seed-prensa.ts` (`pnpm --filter api prisma:seed-prensa`) — siembra los 10 tipos de Prensa.
- `apps/api/src/routes/tickets.ts` — filtro `?area`, deriva `macroEstado` de `subEstado`, campos gestión-pitch.
- `packages/types` + `packages/schemas` — enums/catálogo canónicos (NO consumidos en runtime por api/web; son los paquetes con drift). Catálogo runtime real: `apps/web/src/lib/estados.ts` (front) + mapa inline en el route (back).
- `apps/web/src/lib/estados.ts` — catálogo de presentación (MACROS, PRENSA_SUBESTADOS, colores, defaults).
- `apps/web/src/pages/PrensaBacklogPage.tsx` — board 4 macro-cols, subestados como sub-secciones drag&drop, card con chip gestión-pitch.
- `apps/web/src/components/CreateTicketModal.tsx` — prop `area`, tipo PRENSA (chip estático), filtra tipos kind=PRENSA, campos gestión-pitch condicionales (`esGestionPitch`), gateo de contenido via `noContenido = esTarea || esPrensa`.
- `Layout.tsx` (nav item Prensa), `App.tsx` (ruta `/prensa`).

## Pendientes
- Aplicar migración a la DB (decisión de Javi) + correr `seed-prensa`.
- Alinear lo visual del board con `BacklogKanban.tsx` del Figma Make (Javi lo iba a pegar; no se puede leer vía MCP).
- `TicketDetallePage` NO muestra campos de Prensa (la edición de prensa va por el modal). Follow-up menor.
- Pendientes HU: Stand by vs Pendiente (diferencia operativa), orden fino de subestados.

Ver HU: https://app.notion.com/p/376617fc36928116866fd6b2d1b7d8b9 · Dev task: https://app.notion.com/p/37d617fc36928126a2f7ffe024b67090
