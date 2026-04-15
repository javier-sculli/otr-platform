# TicketDetallePage — Implementación

**Fecha:** 2026-03-31
**Archivos afectados:**
- `apps/web/src/pages/TicketDetallePage.tsx` (nuevo)
- `apps/web/src/components/CreateTicketModal.tsx` (modificado)
- `apps/web/src/App.tsx` (ruta registrada)

## Qué se implementó

Página completa de detalle de ticket accesible desde `/piezas/:ticketId`.

### Estructura
- **Header sticky**: título editable inline (hover → lápiz → input), badges de meta, botón "Redactar" → `/content/:id`
- **Columna principal (2/3)**: Brief (read-only), Info/Recursos (editable inline), Entregable visual (editable inline)
- **Sidebar (1/3)**: estado (select con mutación inmediata), owner, canal, área, tipo, prioridad, historial

### Info / Recursos — edición inline
- Lista de links con botón ✕ en hover para eliminar
- Input "Pegar link + Enter" para agregar nuevos
- Llama a `updateMutation.mutate({ links: [...array actualizado] })`

### Entregable visual — edición inline
- Sin link: input directo con botón `+`
- Con link: muestra el link, hover revela botones editar/eliminar
- Llama a `updateMutation.mutate({ linkEntregable: url | null })`

### CreateTicketModal — cambios
- Campos `links` y `linkEntregable` solo visibles en modo **edición** (no en creación)
- Botón "Ver completo" en footer → navega a `/piezas/:id`

## Decisiones

- Los campos `links` (array) y `linkEntregable` (string|null) ya existían en el backend. No requirieron cambios de schema.
- Edición inline en la página de detalle, no en el modal. El modal es para brief rápido.
- Referencia de diseño: componente `TicketDetalle.tsx` en Figma Make (`OFmYKfJm5ZisjhusaGA0xb`)
- Entregable visual = un solo link (string), aunque Figma mostraba array. Se mantuvo string para no romper el schema.

## Estado
- Implementado y funcionando en local
- **Pendiente commitear**
