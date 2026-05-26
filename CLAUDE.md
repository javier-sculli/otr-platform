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

## Equipo OTR
| Quién | Rol |
|-------|-----|
| **Joaco** (Joaquín María Tagle) | CEO de On The Rocks |
| **Manuela Ghitta** | Contenidista principal — usuario principal de la plataforma |
| **Shaiel Terán** | Equipo OTR |
| **Paloma Ascurdía** | Equipo OTR |

## Tareas pendientes de implementar
> Surgidas de la weekly OTR con la contenidista. Ver Notion para detalle completo.

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
