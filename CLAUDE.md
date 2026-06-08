# OTR Platform — Contexto para Claude Code

## El proyecto
Sistema de gestión de producción de contenido para On The Rocks (OTR), una agencia de contenido.
- **Cliente:** Joaco (CEO de On The Rocks)
- **Dev / Diseño / Producto:** Javi Sculli
- **Figma Make (diseño):** https://www.figma.com/make/OFmYKfJm5ZisjhusaGA0xb/Content-Production-System
  - fileKey: `OFmYKfJm5ZisjhusaGA0xb`
  - Para leer el diseño: `get_design_context(fileKey, nodeId: "0:1")` → devuelve resource links a todos los archivos fuente

## Stack
- Monorepo (pnpm workspaces)
- `apps/web` — frontend React + TypeScript + Vite + shadcn/ui
- `apps/api` — backend
- `packages/schemas` / `packages/types` — tipos compartidos

## Modelo de datos (real, en código)
- Entidad central: **`Ticket`** — unifica contenido y no-contenido. Campos en shared types (`packages/types`): `title`, `description`, `clientId`, `ownerId`, `areaId`, `ticketTypeId`, `status`, `closeReason`, `dueDate`, `links[]`.
- **`TicketType`** es una **tabla dinámica** (no un enum): los tipos/formatos (Carrusel, Reporte, etc.) son filas configurables. El modal los lee con `api.getTicketTypes()`.
- **`TicketStatus`** (enum, 5 estados gruesos): `BACKLOG · EN_PROGRESO · REVISION · BLOQUEADO · CERRADO`.
- **`TicketCloseReason`**: `PUBLICADO · ENTREGADO · CANCELADO` (al pasar a CERRADO). Contenido cierra en `PUBLICADO`; las Tareas cierran en `ENTREGADO`.
- ⚠️ **Drift frontend ↔ shared types:** el frontend (`CreateTicketModal`, `TicketDetallePage`) usa más campos que los shared types, casteando con `as any`: `prioridad` (`ALTA/MEDIA/BAJA`), `objetivo` (brief), `canales[]`, `pilarId`, `speakerId`, `linkEntregable` (string único), `content`/`contentPerCanal`, `notasAudiovisual`. Conviene ir subiéndolos a `packages/types` + `packages/schemas`.
- ⚠️ El default de status en el modal es `'PENDIENTE'`, que NO existe en el enum `TicketStatus` (`BACKLOG`...). Hay drift; verificar al implementar.

## Pantallas principales (nav)
| Pantalla | Componente principal |
|----------|----------------------|
| Clientes | `Clientes.tsx` |
| Backlog | `CalendarioBacklog.tsx` (kanban: Backlog → Brief → Contenido) |
| Content / Workspace | `WorkspacePieza.tsx` |
| Performance | `PublicationPerformance.tsx` |

> ⚠️ **Mapa de archivos real (verificado 2026-06-08).** Las pages están en `apps/web/src/pages/`: `BacklogPage`, `ContentPage`, `ClientesPage`, `ClienteDetallePage`, `PerformancePage`, `PublicationDetailPage`, `TicketDetallePage`, `VozDeMarcaPage`, `VocerosPage`, `LoginPage`, `AuthCallbackPage`. Componentes en `apps/web/src/components/`: `CalendarioBacklog`, `CreateTicketModal`, `Layout`, `Toggle`. Varios nombres de la tabla de arriba y de la lista de abajo (`WorkspacePieza`, `PublicationPerformance`, `BrandManager`, `ReviewAprobacion`, `TicketList/Detail/Estructurado`, `ModalPieza`, `BibliotecaGanadores`, `DerivacionesRed`, `BacklogIdeas`) son conceptuales/Figma y **todavía NO existen en el código**. El kanban real es `CalendarioBacklog.tsx`; el modal real es `CreateTicketModal.tsx`; el detalle es `TicketDetallePage.tsx` (`/piezas/:id`).

## Módulos clave
- `BrandManager.tsx` — Brand Kit por cliente (voz, tono, reglas do/don't, overrides por canal)
- `CalendarioBacklog.tsx` — Kanban de producción + vista calendario
- `WorkspacePieza.tsx` — Editor de piezas con asistencia de IA
- `ReviewAprobacion.tsx` — Cola de revisión, comentarios en línea, aprobación cliente
- `TicketList.tsx` / `TicketDetail.tsx` / `TicketEstructurado.tsx` — Sistema de tickets
- `PublicationPerformance.tsx` — Métricas de publicaciones
- `BibliotecaGanadores.tsx` — Piezas de alto rendimiento como referencia
- `DerivacionesRed.tsx` — Colaboraciones y derivaciones de red
- `ModalPieza.tsx` — Vista rápida de pieza desde cualquier pantalla
- `BacklogIdeas.tsx` — Componente interno del kanban (botón + Nueva idea, no es pantalla propia)

## IA integrada
- Actualmente conectado al SDK de GPT
- La IA usa el Brand Kit del cliente activo como contexto en todas las generaciones

## Equipo OTR
| Quién | Rol |
|-------|-----|
| **Joaco** (Joaquín María Tagle) | CEO de On The Rocks |
| **Manuela Ghitta** | Contenidista principal — usuario principal de la plataforma |
| **Shaiel Terán** | Equipo OTR |
| **Paloma Ascurdía** | Equipo OTR |

## Contenido vs Tareas — feature en curso (nomenclatura + fases)
**Nomenclatura (decisión):**
- **Contenido** = piezas publicables en redes (carrusel, imagen, story, reel, texto, hilo, repost, álbum, blog, **newsletter**). El newsletter ES Contenido, no Tarea.
- **Tareas** = otros entregables no-contenido / no publicables (deck, estrategia, reporte, diseño puntual, otro). Antes lo llamábamos "tarea genérica".
- En el modelo actual, **una Tarea = un `Ticket` con un `TicketType` no-contenido** que cierra en `ENTREGADO`. Reusa la infraestructura existente; NO es un modelo nuevo.

**Fase 1 — construir AHORA (aditiva, no rompe el backlog):**
- Tipo de ticket "Tarea" reusando las **columnas del backlog actual**. NO agregar columnas, carriles (swimlanes), zoom ni filtros avanzados.
- Diferenciar visualmente Tarea vs Contenido (badge/color de tipo) + filtro básico `Todos / Contenido / Tareas`.
- Campos de la Tarea (según doc de la contenidista): título, cliente, tipo de entregable (Deck/Estrategia/Reporte/Diseño puntual/Otro), descripción, fecha de entrega, responsable, prioridad, link del entregable, estado, comentarios.
- Módulos reales a tocar: `CreateTicketModal.tsx`, `CalendarioBacklog.tsx`, `BacklogPage.tsx`, `TicketDetallePage.tsx`, `packages/schemas`, `packages/types`.

**Fase 2 — NO construir todavía (a validar con el equipo):**
- Rediseño de vistas del tablero: zoom consolidada/extendida, carriles por tipo, filtro por tipo, agrupar por persona. Documentado pero pendiente de validación; no implementar en Fase 1.

⚠️ **Decisión pendiente (estados):** la contenidista documentó un flujo granular para las Tareas — `Ideación → Redacción (si aplica) → Diseño/Edición (si aplica) → Revisión interna → Para enviar → Pend. aprobación → Requiere ajustes ↺ / Listo` — que **NO existe en el modelo** (hoy son 5 estados gruesos: `BACKLOG/EN_PROGRESO/REVISION/BLOQUEADO/CERRADO` + `closeReason`). Antes de codear hay que decidir: ¿overhaul del status para soportar los estados granulares, o mapear el flujo del doc a los 5 estados actuales? La decisión de producto fue "mantener los estados completos del doc", pero implica cambiar el modelo de status.

**Referencias:**
- HU Fase 1 (Tareas): https://app.notion.com/p/379617fc369281419f9de57970caf426
- HU Fase 2 (Vistas del tablero): https://app.notion.com/p/376617fc36928116866fd6b2d1b7d8b9
- Tareas de desarrollo Fase 1: 5 ítems con prefijo `F1 ·` en la base de Tareas de Desarrollo.
- Doc de procesos de la contenidista: `BAJADAS INFO ROCKY` (flujos por formato, publicable vs no publicable, ticket de "otros pedidos").

## Proceso de documentación
- **Historia de usuario** (Notion → Historias de usuario): todo el detalle — contexto, problema, decisiones tomadas, criterios de aceptación, módulos afectados, prioridad
  - URL directa: https://www.notion.so/Historias-de-Usuario-311617fc369280539087d9efd37755c5
  - **Siempre buscar las US en esta URL antes de implementar cualquier feature**
- **Tarea de desarrollo** (Notion → Tareas de Desarrollo): lo necesario para implementar + link a la HU correspondiente

## Decisiones de producto tomadas
- El chat muestra el razonamiento/decisiones; la Reaccion muestra el contenido generado — mantener bien separado
- El modo dual es para fase de prueba/calibracion, no necesariamente permanente
- BacklogIdeas no es pantalla propia, vive dentro del kanban de Backlog
- La Biblioteca de Ganadores alimenta sugerencias de referencia en el Workspace
- El popup (ModalPieza) se simplifica: vista rapida + botones "Ver completo" y "Redactar"
- El ticket tiene vista completa dedicada (/piezas/:id) para escalar con mas campos
- RECURSOS en ticket = links o adjuntos (multiples). ENTREGABLE VISUAL = solo links (Drive) por ahora
- El Brand Kit tendra seccion de canales: tono y lineamientos minimos por red social
- Kit del Vocero = capa sobre el Brand Kit, con tono personal y scraping de perfil social

## Memoria del proyecto

> Los archivos de memoria viven en `/memory/` en la raiz del repo.
> **Al iniciar una conversacion, leer `/memory/INDEX.md`** para tener contexto de lo implementado y las decisiones tomadas.
> **Al terminar algo nuevo, actualizar la memoria**: crear o editar el archivo correspondiente en `/memory/` y actualizar `INDEX.md`.

## Deployment (Railway)

**Estado actual (2026-05-26):**
- `apps/web` (frontend) — Se despliega **automaticamente** en Railway al hacer push a `main` (webhook configurado)
- `apps/api` (backend) — Requiere **deploy manual** via Railway CLI

### Deploy del API (manual)

```bash
# 1. Instalar CLI de Railway (si no esta)
npm install -g @railway/cli

# 2. Login en Railway
railway login

# 3. Deploy del API
railway up --service api -m "descripcion del cambio"

# Con detach (no espera a que termine):
railway up --service api --detach -m "descripcion del cambio"
```

**Notas:**
- El comando `railway up` sube el codigo del proyecto actual y lo despliega
- Usa `--service api` para especificar que es el servicio API
- Usa `-m` para agregar un mensaje descriptivo al deployment
- Usa `--detach` si quieres que termine rapido sin esperar logs

## Notion del proyecto
- Hub principal: https://www.notion.so/2f1617fc36928073874dcd55f6937327
- Historias de usuario: https://www.notion.so/311617fc369280539087d9efd37755c5
- Tareas de desarrollo: https://www.notion.so/325617fc3692819485a4de73daf5c28c
- Reuniones: https://www.notion.so/2f1617fc3692801e9929d2196ffee78b
