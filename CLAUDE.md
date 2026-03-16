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

## Pantallas principales (nav)
| Pantalla | Componente principal |
|----------|----------------------|
| Clientes | `Clientes.tsx` |
| Backlog | `CalendarioBacklog.tsx` (kanban: Backlog → Brief → Contenido) |
| Content / Workspace | `WorkspacePieza.tsx` |
| Performance | `PublicationPerformance.tsx` |

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

## Tareas pendientes de implementar
> Surgidas de la weekly OTR con la contenidista. Ver Notion para detalle completo.

### 1. [UI] Rescalar pantalla de Reacción
- Problema: se ve con demasiado zoom en resoluciones bajas / zoom de sistema activo
- Fix: revisar CSS/layout para que sea responsive entre 1280px–1920px y zoom 100%–150%
- Testear que no se corte ningún elemento (chat, input, acciones)

### 2. [UX] Mover quick actions al área del chat
- Las quick actions están desconectadas del flujo del chat
- Moverlas dentro del área de conversación (chips sobre el input o acciones flotantes)
- Al clickearlas, el resultado se inserta directo en el chat

### 3. [Feature] Modo respuesta dual con segundo modelo
- Agregar selector de modelo alternativo en Settings (además de GPT)
- Toggle para activar/desactivar modo dual
- Cuando está activo: ambos modelos responden en paralelo con el mismo Brand Kit
- UI: respuestas side-by-side o en tabs (Modelo A | Modelo B)
- En el chat: cada modelo tiene su propia respuesta (no un resumen unificado)
- Por defecto: arranca con los 2 modelos prendidos
- Scope futuro: simplificar a botón "regenerar con otro modelo" si el dual no agrega valor en uso real

## Decisiones de producto tomadas
- El chat muestra el razonamiento/decisiones; la Reacción muestra el contenido generado — mantener bien separado
- El modo dual es para fase de prueba/calibración, no necesariamente permanente
- BacklogIdeas no es pantalla propia, vive dentro del kanban de Backlog
- La Biblioteca de Ganadores alimenta sugerencias de referencia en el Workspace

## Notion del proyecto
- Hub principal: https://www.notion.so/2f1617fc36928073874dcd55f6937327
- Historias de usuario: https://www.notion.so/311617fc369280539087d9efd37755c5
- Tareas de desarrollo: https://www.notion.so/325617fc3692819485a4de73daf5c28c
- Reuniones: https://www.notion.so/2f1617fc3692801e9929d2196ffee78b
