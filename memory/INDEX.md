# OTR — Memoria del proyecto

Índice de lo implementado y decisiones relevantes. Leer al inicio de cada conversación.

## Features implementadas

| Feature | Archivo | Estado | Fecha |
|---------|---------|--------|-------|
| TicketDetallePage (`/piezas/:id`) | [ticket-detalle.md](ticket-detalle.md) | ✅ Implementado, sin commitear | 2026-03-31 |
| Campos links en ticket (Info/Recursos + Entregable visual) | [ticket-detalle.md](ticket-detalle.md) | ✅ Implementado inline en TicketDetallePage | 2026-03-31 |
| Modo dual de modelos (Claude + GPT) | [modo-dual.md](modo-dual.md) | ✅ Implementado | Antes de 2026-03-31 |
| Reducción densidad visual ~20% | — | ✅ Commiteado | Antes de 2026-03-31 |
| LinkedIn Metrics — scraping con Apify + cron diario | [linkedin-metrics.md](linkedin-metrics.md) | ✅ Backend listo, frontend conectado | 2026-03-31 |
| Instagram + Twitter Metrics — Apify sync + UI multi-red | [social-metrics.md](social-metrics.md) | ✅ Backend + Frontend completo | 2026-05-28 |
| Tareas (HU Fase 1) — TicketType.kind, toggle en modal, badge navy, filtro Todos/Contenido/Tareas | [tareas-fase1.md](tareas-fase1.md) | ✅ Implementado y verificado en local | 2026-06-08 |

## Decisiones de producto activas

- La edición de recursos/links se hace inline en TicketDetallePage, NO en el modal (modal = brief rápido)
- El entregable visual es un solo link (string), no array — consistente con schema actual
- BacklogIdeas no es pantalla propia, vive dentro del kanban
- El modo dual es para calibración, no necesariamente permanente
- Tarea = Ticket con `TicketType.kind = TAREA`; comparte los mismos 11 estados que Contenido (no se overhauleó el status en Fase 1)
- Diferenciación Tarea/Contenido: badge navy sólido + filtro segmentado Todos/Contenido/Tareas; modal único con toggle arriba

## Convenciones de código

- Colores del sistema: `#000033` (dark), `#024fff` (blue), `#00ff99` (green)
- Texto: `text-xs` como base, `text-sm` para contexto más amplio
- Borders: `border-2` como estándar
- Todas las mutaciones usan `@tanstack/react-query` con `invalidateQueries` post-éxito
