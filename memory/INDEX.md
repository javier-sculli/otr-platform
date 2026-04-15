# OTR — Memoria del proyecto

Índice de lo implementado y decisiones relevantes. Leer al inicio de cada conversación.

## Features implementadas

| Feature | Archivo | Estado | Fecha |
|---------|---------|--------|-------|
| TicketDetallePage (`/piezas/:id`) | [ticket-detalle.md](ticket-detalle.md) | ✅ Implementado, sin commitear | 2026-03-31 |
| Campos links en ticket (Info/Recursos + Entregable visual) | [ticket-detalle.md](ticket-detalle.md) | ✅ Implementado inline en TicketDetallePage | 2026-03-31 |
| Modo dual de modelos (Claude + GPT) | [modo-dual.md](modo-dual.md) | ✅ Implementado | Antes de 2026-03-31 |
| Reducción densidad visual ~20% | — | ✅ Commiteado | Antes de 2026-03-31 |
| LinkedIn Metrics — scraping con Apify + cron diario | [linkedin-metrics.md](linkedin-metrics.md) | ✅ Backend listo, frontend pendiente | 2026-03-31 |

## Decisiones de producto activas

- La edición de recursos/links se hace inline en TicketDetallePage, NO en el modal (modal = brief rápido)
- El entregable visual es un solo link (string), no array — consistente con schema actual
- BacklogIdeas no es pantalla propia, vive dentro del kanban
- El modo dual es para calibración, no necesariamente permanente

## Convenciones de código

- Colores del sistema: `#000033` (dark), `#024fff` (blue), `#00ff99` (green)
- Texto: `text-xs` como base, `text-sm` para contexto más amplio
- Borders: `border-2` como estándar
- Todas las mutaciones usan `@tanstack/react-query` con `invalidateQueries` post-éxito
