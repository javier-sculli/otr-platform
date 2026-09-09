# Bitácora de Desarrollo y Seguimiento — OTR Platform (Rocky / Ruki)

> **Propósito:** Registro central de avances, decisiones de producto, correcciones de errores y backlog priorizado de la plataforma Rocky (OTR). A partir de la reunión del 31 de Julio de 2026, cada cambio, bugfix y feature completado queda asentado en esta bitácora.

### [2026-09-09] — Actualización de Backlog Oficial en Notion, Opción "Otro" en Prensa y Migración de Blog/Newsletter a Tareas
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Configuración de Backlog Oficial de Notion (`CLAUDE.md`):** Se fijó el enlace oficial del Backlog de Notion (`https://app.notion.com/p/Backlog-3ba617fc369281048bfdfc89c5041d9c?source=copy_link`) como fuente de verdad única para el seguimiento de tareas en el proyecto.
  2. **Opción "Otro" en Tipo de Prensa (`apps/api/src/routes/catalogs.ts` y `seed-prensa.ts`):** Se incorporó el tipo "Otro" a las opciones de entregable de Prensa, garantizando su presencia en la base de datos y su ordenamiento automático al final de la lista desplegable en la interfaz.
  3. **Reorganización de Formatos (Blog y Newsletter a Tareas):** Se removieron "Blog", "Artículo Blog" y "Newsletter" del catálogo de Contenido/Pieza y se migraron a la categoría Tarea (`kind: 'TAREA'`). Todos los tickets de esos tipos fueron migrados automáticamente en base de datos.
- **Verificación:** Pruebas e-to-e en navegador con Playwright en Chrome headless sobre `localhost:5173` y `localhost:3001` con 100% de éxito y capturas generadas.

### [2026-08-25] — Formateo de Entregable Visual como Link Activo e Indicadores de Guardado en Detalle de Ticket y Popup
- **Desarrollador:** Javier Sculli & Antigravity
- **Resumen de Avances:**
  1. **Entregable Visual como Link Interactivo (`TicketDetallePage.tsx` y `CreateTicketModal.tsx`):** Se actualizó la sección de entregable visual tanto en el detalle como en el popup modal del ticket (`CreateTicketModal`) para tratar el link como una URL clicable en azul eléctrico (`#024fff`) con icono `Link2` y apertura externa en nueva pestaña (`target="_blank"`).
  2. **Auto-Guardado Inteligente y Pegado de Links (`TicketDetallePage.tsx` y `CreateTicketModal.tsx`):** Se agregaron manejadores para `onPaste`, `onBlur` y `Enter` en el campo de entrada del link entregable, permitiendo pegar o escribir una URL (ej. Google Drive) y guardar automáticamente.
  3. **Indicadores de Estado de Guardado en UI (`TicketDetallePage.tsx`):** Se integraron badges visuales de feedback (*"Guardando..."*, *"Guardado"*, *"Error al guardar"*) en las secciones de Copy y Notas de Diseño.
- **Verificación:** Commits `f8dcc98` y `8d054d9` subidos a `main` y desplegados a Vercel/Railway.

### [2026-08-25] — Notificaciones por Email con Estética ROCKY, Estandarización de Asuntos e Integración con Resend
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Servicio de Emailing en Backend (`apps/api/src/lib/email.ts`):** Módulo de envío asincrónico integrado con la API de Resend SDK (`resend`). Generación de plantillas HTML responsive con CSS inline alineadas a la identidad de ROCKY (Navy `#000033`, Azul Eléctrico `#024fff`, fondo `#f4f5f7`, tarjetas bordeadas y badges estilizados).
  2. **Estandarización del Asunto (Subject Line Standard):** Formato limpio tipo SaaS (`[ROCKY] [{Tipo/Estado}] · {NombreTicket}`):
     - Mención: `[ROCKY] [Mención] · {NombreTicket}`
     - Asignación: `[ROCKY] [Asignación] · {NombreTicket}`
     - Cambio de Estado: `[ROCKY] [Cambio de estado] · {NombreTicket}`
  3. **Despacho Automático en Background (Non-blocking):** Integración en `routes/tickets.ts` (`notifyOrCoalesce`) y `routes/comments.ts` para disparar correos en segundo plano (`setImmediate`) al crear menciones, asignaciones o cambios de estado, garantizando que el servidor responda HTTP en <100ms.
  4. **Script de Pruebas (`scripts/send-test-emails.ts`):** Creado y ejecutado exitosamente para validar el envío directo de ejemplos de los 3 tipos de notificación a `javier.sculli@gmail.com`.
- **Verificación:** Monorepo verificado con `pnpm --filter api typecheck` (0 errores) y despacho exitoso de los 3 correos de prueba en Resend (IDs: `e1047076-0525-4266-bee7-e515f628c42a`, `09c8d96d-9079-4fa9-a2e9-d70d84c30433`, `35ed2d0d-8107-4473-a715-021844475ebf`).

### [2026-08-24] — Roles Genéricos de Agencia, Registro (Sign Up) en Login y Modal de Selección de Rol Inicial (Onboarding)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Configuración de Roles Genéricos en DB:** Se crearon y normalizaron las 5 áreas/roles genéricos en la base de datos de PostgreSQL/Supabase: **`Dirección`**, **`Contenido`**, **`Prensa`**, **`Diseño`** y **`Video`**. Se asignaron masivamente las áreas y roles correspondientes a los 12 usuarios activos existentes en la plataforma.
  2. **Endpoint de Registro (`POST /auth/register`):** En `apps/api/src/routes/auth.ts`, se desarrolló la ruta para crear cuentas nuevas mediante email, nombre y contraseña con hash seguro (bcrypt), retornando el JWT inmediatamente para inicio de sesión continuo.
  3. **Solapa de Registro ("Sign Up") en Login (`LoginPage.tsx`):** Se rediseñó la pantalla de acceso con un toggle de pestañas (*"Iniciar sesión"* vs *"Registrarse"*), agregando el formulario de creación de cuenta y manteniendo la opción de *Continuar con Google*.
  4. **Modal de Selección de Rol al Primer Ingreso (`RoleOnboardingModal.tsx`):** Al iniciar sesión por primera vez o si un usuario no posee un área asignada (`!user.areaId`), se despliega de forma automática un modal interactivo para seleccionar su rol genérico principal (*Dirección, Contenido, Prensa, Diseño, Video*), guardándolo de forma permanente en la base de datos vía `PATCH /auth/me`.
- **Verificación:** Monorepo verificado con builds de producción limpios (`pnpm --filter api build` y `pnpm --filter web build`) con 0 errores.

### [2026-08-24] — Reporte de Tickets Creados por Día (Vista Mensual con Gráficas Absolutas y Acumuladas por Cliente)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Nuevo Endpoint en API (`GET /reports/tickets-creados-diarios`):** En `apps/api/src/routes/reports.ts`, se desarrolló el endpoint que procesa los tickets creados en el mes seleccionado (`createdAt`) y genera las métricas diarias absolutas y acumuladas para cada cliente activo, más el total acumulado de la agencia y KPIs de resumen (promedio diario, día pico y cliente top).
  2. **Integración en Cliente API (`apps/web/src/lib/api.ts`):** Añadido `getTicketsCreadosDiarios(year, month)` a la clase `ApiClient`.
  3. **Nueva Sub-Solapa en Reportes de Agencia (`ReportesPage.tsx`):** Creada la pestaña **"Tickets Creados por Día"** en la sección `/reportes`.
  4. **Gráfica de Líneas Recharts con Colores por Cliente:**
     - Renderiza líneas **Absolutas (Sólidas —)** para visualizar las creaciones por día.
     - Renderiza líneas **Acumuladas (Punteadas - - -)** para seguir la evolución del volumen del cliente en el mes.
     - Incorpora toggles de control para encender/apagar líneas absolutas, acumuladas o el total general de la agencia.
     - Filtro interactivo de clientes con badges para aislar clientes en la gráfica.
     - Tooltip interactivo con desglose de valores al pasar el cursor sobre cualquier fecha.
  5. **Tabla de Desglose Mensual:** Resumen por cliente con volumen total del mes, % de participación y promedio diario.
- **Verificación:** Monorepo verificado con compilaciones de producción totalmente limpias (`pnpm --filter api build` y `pnpm --filter web build`) con 0 errores de TypeScript.

### [2026-08-24] — Fixes en Editor de Copys (Negritas, Selector de Emojis y Preservación de Párrafos entre Redes)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Preservación de Espaciado de Párrafos entre Redes (`RichNotesEditor.tsx`):** Se actualizó el algoritmo de limpieza de HTML (`cleanJunkHtmlBlocks`) para que **NO** elimine contenedores de salto de línea vacíos (`<p><br></p>`, `<div><br></div>`, `<br>`, `&nbsp;`). Ahora, al cambiar entre solapas de redes sociales (ej. LinkedIn, Instagram, etc.), los saltos de línea y el espaciado entre párrafos se mantienen 100% intactos.
  2. **Fix de Negritas y Formatos por Click (`RichNotesEditor.tsx`):** Se añadió `onMouseDown={(e) => e.preventDefault()}` a todos los botones de la barra de herramientas (`Bold`, `Italic`, `Underline`, `Strikethrough`, listas, etc.). Esto evita que el navegador des-seleccione el texto al hacer click en las herramientas de formato. Asimismo, se agregó soporte de conversión automática de sintaxis Markdown (`**negrita**` / `__negrita__`) a `<strong>`.
  3. **Selector/Picker de Emojis Integrado y Búsqueda por Palabras Clave (`RichNotesEditor.tsx`):** Se implementó un popover desplegable con selector de emojis categorizado (*Frecuentes / Destacados, Caras, Gestos, Símbolos, Corazones*) y campo de búsqueda interactivo. Se corrigió el bloqueo de foco del `<input>` (causado por `preventDefault` en el contenedor padre) y se añadieron palabras clave en español (*"fuego"*, *"ok"*, *"corazon"*, *"link"*, *"check"*, *"arriba"*, etc.) para filtrar emojis por texto.
  4. **Limpieza de Barra de Herramientas redundante (`ContentPage.tsx`):** Se removió la barra de botones decorativos sin handlers en `ContentPage` y se consolidó el control de edición en la barra de herramientas interactiva del `RichNotesEditor`, manteniendo los controles de `Deshacer`, `Ver historial` y contador de caracteres en la barra de acciones superior.
- **Verificación:** Monorepo verificado con compilación limpia (`pnpm --filter web build`) con 0 errores.

### [2026-08-21] — Guardado Defensivo de `contentPerCanal` (Backend Merge y Protecciones Frontend)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Merge Defensivo en API (`apps/api/src/routes/tickets.ts`):** En `PATCH /tickets/:id`, se incluyeron `contentPerCanal` y `versionsPerCanal` en la consulta previa (`existingTicket`) y se implementó un algoritmo de fusionado seguro. Si el payload entrante trae cadenas vacías o un objeto vacío `{}` para un canal que ya posee texto en la DB, el backend preserva defensivamente el contenido original, impidiendo que peticiones con payloads incompletos borren el copy.
  2. **Protección en Auto-Guardado de Modal (`CreateTicketModal.tsx`):** Al auto-guardar cambios de metadatos (estado, asignados, fechas), el modal omite la propiedad `contentPerCanal` de la mutation salvo que el objeto contenga texto real para algún canal. Además, si se abre un ticket sin `contentPerCanal` cargado, se activa un fallback directo al historial de `versionsPerCanal`.
  3. **Guardado Seguro en Detalle de Ticket (`TicketDetallePage.tsx`):** En `handleCopySave`, se implementó una fusión del estado local con `ticket.contentPerCanal` existente antes de emitir la petición, evitando pisar otros canales.
  4. **Regla Estricta de Redacción IA en Solapa Activa (`ai.ts` y `ContentPage.tsx`):** Por definición de flujo de trabajo del usuario, la IA no infiere ni cambia de red social; la redacción y adaptación por IA pisa y guarda siempre estrictamente sobre la solapa activa (`activeCanal`) en la que el usuario se encuentra parado.
  5. **Integración de `RichNotesEditor` en Pantalla de Redacción (`ContentPage.tsx`):** Se reemplazó el `<textarea>` de texto plano por el editor enriquecido `<RichNotesEditor>`. Ahora los formatos de negrita, cursiva, listas y encabezados aplicados en el modal/popup se renderizan visualmente formateados en lugar de mostrar caracteres de etiquetas HTML (`<b>`) o Markdown (`**`).
- **Verificación:** Monorepo verificado con compilaciones limpias (`pnpm --filter web build` y `pnpm --filter api build`) con 0 errores de TypeScript.

### [2026-08-20] — Regla de Producto: Contenido 100% por Red Social (contentPerCanal), Fix de Copy Perdido y Rescate DB
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Regla de Producto (`contentPerCanal`):** El campo genérico legacy `content` deja de ser la fuente principal. Las piezas se asocian siempre a sus redes sociales (`canales`) y el texto se almacena y lee estrictamente por canal desde `contentPerCanal`.
  2. **Hidratación con Fallback desde `versionsPerCanal` (`TicketDetallePage.tsx` y `ContentPage.tsx`):** Si `contentPerCanal` o la clave de una red no poseen texto, la interfaz explora automáticamente la última versión generada por Jeeves en `versionsPerCanal[canal]`, impidiendo que el editor aparezca vacío.
  3. **Rescate en Base de Datos (`0d52e478-c001-4aba-b171-80c31e80aac7`):** Rescatado en Supabase el copy completo generado en castellano para LinkedIn desde `versionsPerCanal.LinkedIn` hacia `contentPerCanal.LinkedIn`.
  4. **Persistencia de Campos en API (`routes/tickets.ts`):** Añadidos `contentPerCanal`, `content`, `versionsPerCanal` y `notasAudiovisual` al `select` de `prisma.ticket.update` para evitar que las mutations limpien el copy en la caché de React Query.
  5. **Manejador de Tabs sin Race Conditions (`ContentPage.tsx`):** Refactorizado el cambio de solapas mediante actualizador funcional (`setContentPerCanal(prev => ...)`), resolviendo la asignación de cadenas vacías por clausura obsoleta.
- **Verificación:** typecheck compilado con 0 errores en todos los paquetes.

### [2026-08-19] — Fix de Menciones (@), Nombre de Remitente en Notificaciones y Guardado Optimista de Comentarios (0ms)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Algoritmo de Menciones Robusto (`comments.ts`):** Se reemplazó la expresión regular previa por un reconocedor de candidatos ordenados (nombres completos, primeros nombres, usuario de email y apodos del diccionario `NICKNAMES` como `@manu`, `@joaco`, `@javi`, `@shai`, `@palo`, etc.). Las menciones en comentarios ahora detectan a los usuarios destinatarios sin fallar por espacios o signos de puntuación.
  2. **Resolución de Remitente de Notificación (`comments.ts`):** Se corrigió la consulta asincrónica para obtener el `name` real del usuario que menciona, generando mensajes legibles (ej: *"Javier Sculli te mencionó en..."*) en lugar del fallback a email raw.
  3. **Optimistic UI para Comentarios a 0ms (`TicketDetallePage.tsx`):** Se implementó `onMutate` en `createCommentMutation` y `deleteCommentMutation` con caché directo de React Query. El comentario aparece al instante en la lista y vacía el campo de texto a 0ms sin esperar peticiones secundarias `GET /tickets/:ticketId/comments`.
  4. **Intervalo de Polling de Notificaciones (`Layout.tsx`):** Ajustada la frecuencia de consulta de notificaciones de 60s a 15s para que el receptor vea las campanas de mención casi en tiempo real.
- **Verificación:** Compilación del monorepo (`pnpm build`) verificada exitosamente con 0 errores en todos los paquetes.

### [2026-08-19] — Formatos de Contenido Independientes: Imagen y Placa Gráfica (Ambos con Diseño Gráfico)
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Dos Formatos Independientes:** Se establecieron formalmente **"Imagen"** (foto / pieza de imagen) y **"Placa Gráfica"** (gráfica) como los 2 tipos principales de contenido gráfico en `CONTENIDO`.
  2. **Reglas de Workflow Unificadas para Diseño (`workflow.ts`):** Tanto **`Imagen`** como **`Placa Gráfica`** evalúan `requiresDesign` a `true`, asegurando que ambas piezas pasen siempre por la etapa de Diseño Gráfico (`REDACCIÓN` → `DISEÑO` → `REVISIÓN INTERNA`).
  3. **Auto-Migración e Invalidación de Caché (`catalogs.ts`):** El endpoint `GET /ticket-types` limpia la memoria caché previa e invalida tipos duplicados/legados (`Placa con diseño`, `Imagen Gráfica`, `Gráfica`), re-apuntando sus tickets a `Placa Gráfica` e `Imagen`.
  4. **Migración SQL Prisma:** Actualizada la migración idempotente `20260819120000_separate_imagen_and_placa_types` en PostgreSQL.
- **Verificación:** Typecheck de TypeScript verificado con 0 errores en todos los paquetes del monorepo (`pnpm typecheck`).

### [2026-08-19] — Brief de Ticket Auto-Expandible y Layout en 2 Columnas (Pilares y Redes)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Componente Reutilizable (`AutoResizeTextarea`):** Creado en `apps/web/src/components/AutoResizeTextarea.tsx` con auto-expansión dinámica basada en `scrollHeight` y manejo de `minHeight` inteligente.
  2. **Altura de Brief Consistente con Copy (`180px`):** El brief inicia por defecto con la misma altura base que el editor de Copy (`180px` / `minRows=6`) cuando posee texto, y se reduce a 2 líneas (`68px`) al estar vacío para ahorrar espacio.
  3. **Layout de 2 Columnas para Pilares y Redes:** Reorganizados "Pilar de contenido" y "Red(es) objetivo" en una grilla de 2 columnas (`grid-cols-2`) en `CreateTicketModal.tsx`, optimizando el espacio vertical del popup.
  4. **Despliegue en Producción (Railway):** Código commiteado a `main` y servicio API/Web actualizado exitosamente en Railway.

### [2026-08-19] — Corrección de Desfase de Fechas (-1 día en Backlog, Calendario y Detalles)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Solución a Desfase de Zona Horaria (-1 día):** Identificada la causa donde cadenas de fecha ISO `YYYY-MM-DD` o timestamps `T00:00:00.000Z` eran interpretados como medianoche UTC, convirtiéndose a las 21:00 hs del día anterior en husos horarios locales (GMT-3).
  2. **Utilidades de Fecha Seguras (`apps/web/src/lib/utils.ts`):** Añadidas funciones `parseLocalDate`, `formatDateSpan` y `formatDateISO` para procesar y renderizar fechas locales a las 00:00 hs sin descalce de zona horaria.
  3. **Actualización de Componentes de Frontend:** Integradas las funciones en `BacklogPage.tsx`, `PrensaBacklogPage.tsx`, `CalendarioBacklog.tsx`, `TicketDetallePage.tsx`, `CreateTicketModal.tsx`, `PerformancePage.tsx` y `PublicationDetailPage.tsx`.
  4. **Persistencia API Normalizada (`apps/api/src/routes/tickets.ts` y `metrics.ts`):** Normalizado el parseo de fechas en backend mediante `parseApiDate` a mediodía UTC (`12:00:00.000Z`), asegurando consistencia global en cualquier huso horario.
- **Verificación:** `pnpm build` ejecutado exitosamente en los 5 paquetes del monorepo.

### [2026-08-19] — Sistema de Notificaciones Anti-Spam (Diff Real, Debouncing y Menciones Inteligentes)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Diff Real de Estado & Anti-Spam (`PATCH /tickets/:id`):** Se agregó la consulta previa del ticket (`existingTicket`) para comparar si `ownerId` o el estado cambian realmente antes de notificar, erradicando las notificaciones duplicadas generadas por el auto-guardado del frontend.
  2. **Debounce y Coalescencia (`notifyOrCoalesce`):** Implementada una ventana de coalescencia de 5 minutos: si un ticket cambia rápidamente de estado o asignación varias veces, la notificación no leída previa del mismo tipo se actualiza con los datos más recientes en lugar de acumular múltiples filas duplicadas en la BD.
  3. **Notificación en Creación de Ticket (`POST /tickets`):** Agregada la emisión asincrónica de notificación `ASSIGNED` cuando se crea un ticket asignado a otro usuario.
  4. **Notificaciones de Cambio de Estado (`STATUS_CHANGE`):** Activadas las notificaciones automáticas al mover tickets entre columnas Kanban o sub-estados, informando al responsable con nombres legibles (ej. *"Javier Sculli movió 'AGENDA SEPTIEMBRE' a Diseño"*).
  5. **Menciones Inteligentes e Insensibles a Tildes (`@menciones`):** Añadida normalización de diacríticos (`normalizeStr`) y mapeo de alias/apodos del equipo (`joaco`, `manu`, `javi`, `sofi`, `santi`, `agu`, etc.), permitiendo que menciones como `@joaco` o `@sofia` resuelvan correctamente a sus usuarios correspondientes.
- **Verificación:** Typecheck de TypeScript (`npm run typecheck` en `apps/api`) y pruebas de backend aprobados con 0 errores.

---

## 📌 Estado del Proyecto y Backlog Consolidado

### 🔴 Épica 1: Bugs Críticos & Correcciones Inmediatas de Sumario
- [x] **[BUG-01] Selector de Meses Futuros (Habilitación de Agosto - Máximo M+1)**
  - *Problema:* Agosto y meses futuros no aparecían disponibles en el selector del Sumario.
  - *Solución:* Selector dinámico que lista desde meses pasados hasta exactamente el próximo mes (`M+1` relativo al actual).
  - *Estado:* 🟢 Completado (2026-07-31)
- [x] **[BUG-02] Filtrado de Ítems de Prensa por Cliente (Fix leak de Draper)**
  - *Problema:* El sumario mostraba ítems de prensa pertenecientes a otros clientes (Draper).
  - *Solución:* Forzado filtrado estricto por `clientId` tanto en mapeos frontend como en llamadas API.
  - *Estado:* 🟢 Completado (2026-07-31)

### 🟡 Épica 2: Mejoras e Ingesta de Funcionalidades en Sumario
- [x] **[SUM-01] Filtro de Meses Múltiple (Multi-Toggle)**
  - *Detalle:* Selector desplegable con checkboxes que permite elegir múltiples meses en simultáneo (ej. Julio + Agosto).
  - *Estado:* 🟢 Completado (2026-07-31)
- [x] **[SUM-02] Separación por Canales/Formatos (Redes, Blog, Newsletters)**
  - *Detalle:* Agrupamiento en secciones visuales diferenciadas: Redes Sociales, Blog & Artículos, Newsletters.
  - *Estado:* 🟢 Completado (2026-07-31)
- [x] **[SUM-03] Reordenamiento Manual de Filas (Mover arriba / abajo)**
  - *Detalle:* Botones ▲ y ▼ en cada fila para ajustar la secuencia/prioridad de los contenidos.
  - *Estado:* 🟢 Completado (2026-07-31)
- [x] **[SUM-04] Inclusión de Tareas en Vista Sumario**
  - *Detalle:* Toggle `+ Ver Tareas / Incluyendo Tareas` para visualizar tareas no-contenido con distintivo `[Tarea]`.
  - *Estado:* 🟢 Completado (2026-07-31)
- [x] **[SUM-05] Duplicar Filas de Sumario (Marca ↔ Voceros)**
  - *Detalle:* Acción de duplicación en cada fila con selector hacia 🏢 Marca o 👤 [Vocero].
  - *Estado:* 🟢 Completado (2026-07-31)

### 🔵 Épica 3: Pilares de Contenido por Vocero (Vocero-Specific Pillars)
- [ ] **[VOC-01] Gestión de Pilares Propios por Vocero**
  - *Detalle:* Cada vocero debe tener sus propios 4-5 pilares de contenido editables, independientes de los pilares de la marca.
  - *Estado:* 🟡 Planificado
- [ ] **[VOC-02] Filtrado Contextual de Pilares en Ticket y Sumario**
  - *Detalle:* Al seleccionar un vocero al crear contenido o en el sumario, mostrar únicamente los pilares asignados a ese vocero (más opcionalmente los de marca).
  - *Estado:* 🟡 Planificado

### 🟢 Épica 4: UX de Tickets, Clientes y Caja de Diseño/Audiovisual
- [ ] **[UI-01] Edición de Nombre del Cliente**
  - *Detalle:* Permitir editar el nombre del cliente directamente desde la vista/gestión de Clientes.
  - *Estado:* 🟡 Planificado
- [ ] **[UI-02] Rediseño de Jerarquía "Ver Ticket Completo"**
  - *Detalle:* Destar el botón / enlace "Ver ticket completo" en los modales para mejorar la usabilidad.
  - *Estado:* 🟡 Planificado
- [ ] **[UI-03] Distinción "Guardar Rápido" vs "Guardar e ir al Ticket"**
  - *Detalle:* Ofrecer dos acciones claras al guardar un ticket: guardado rápido sin salir o guardar y redirigir al detalle del ticket.
  - *Estado:* 🟡 Planificado
- [x] **[UI-04] Caja Flexible de Instrucciones para Diseño / Audiovisual & Referencias**
  - *Detalle:* Apartado de "Notas de Gráfica / Diseño" con especificaciones por formato, hipervínculos a referencias externas y soporte para previsualización de imágenes.
  - *Estado:* 🟢 Completado (2026-08-04)
- [x] **[UI-05] Selector Desplegable Multi-Formato y Popup de Transición a Diseño**
  - *Detalle:* Selector desplegable con checkboxes para multi-formato (simple para 1 clic, expandible para múltiples). Popup modal `TransitionToDesignModal` al arrastrar o cambiar tarjetas al estado "Diseño".
  - *Estado:* 🟢 Completado (2026-08-04)
- [x] **[UI-06] Auto-selección de Cliente Activo al Crear Tarea / Ticket**
  - *Detalle:* Si existe un filtro de cliente activo seleccionado en el tablero (Backlog o Prensa), al presionar "Nueva" el modal `CreateTicketModal` pre-selecciona automáticamente dicho cliente.
  - *Estado:* 🟢 Completado (2026-08-06)

### 💜 Épica 5: IA, Brand Kit & Procesamiento de Contenido
- [ ] **[IA-01] Limpieza de Texto Plano para Documentos de Estrategia**
  - *Detalle:* Procesar archivos de estrategia/PPT/PDFs convirtiéndolos a texto plano para evitar ruido de formato en el contexto del prompt de IA.
  - *Estado:* 🟡 Planificado
- [ ] **[IA-02] Integración y Exploración de Cloud Design**
  - *Detalle:* Evaluar integración con Cloud Design para templates transaccionales y brand kits por cliente.
  - *Estado:* 🔵 Backlog Futuro

### 🤝 Épica 6: Operativa y Migración del Equipo (Ruki Migration & Workflow)
- [ ] **[OPS-01] Workshop de Alineación del Equipo**
  - *Responsable:* St / Manu
  - *Detalle:* Taller de capacitación la próxima semana para migración total del equipo a Rocky y abandono de Notion/ChatGPT.
  - *Estado:* 🟡 Programado (Semana próxima)
- [ ] **[OPS-02] Depuración de Herramientas y Cierre de ChatGPT**
  - *Responsable:* Joaco / St
  - *Detalle:* Descarga de assets e información relevante de ChatGPT para efectuar el cierre de cuenta y consolidar en Claude/Rocky.
  - *Estado:* 🟡 En curso
- [ ] **[OPS-03] Alineación de Criterios Diseño/Audiovisual**
  - *Responsable:* St
  - *Detalle:* Reunión del lunes con diseñadoras, editor y contenidistas para definir el formato mínimo de bajadas.
  - *Estado:* 🟡 Programado (Lunes)

### [2026-08-13] — Mapeo Estricto de Estados de Flujo por Formato de Contenido (Regla de Negocio)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Actualización de Mapeo de Formatos (`lib/workflow.ts`):**
     - **Regla 1 (Pasan por Diseño Gráfico):** `carrusel`, `placa con diseño`, `story`, `video`, `reel`.
     - **Regla 2 (Pasan por Audiovisual/Edición):** `video`, `reel`.
     - **Regla 3 (No pasan por Diseño ni Audiovisual):** `álbum de fotos`, `imagen`, `hilo`, `texto solo`, `repost` (saltean Diseño y Edición pasando directo de Redacción a Revisión Interna).
  2. **Integración con `getNextStatusInfo` (`lib/estados.ts`, `TicketDetallePage.tsx`, `CreateTicketModal.tsx`):** Se integró la transmisión de `tiposContenido` al calcular `getNextStatusInfo` tanto en el modal popup como en la vista completa de ticket, garantizando que para `video` y `reel` el flujo pase secuencialmente por **Redacción → Diseño → Edición → Revisión Interna**.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) verificada exitosamente (0 errores).

### [2026-08-13] — Fix Auto-guardado de Tipo de Entregables / Formatos en Modal Popup
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Auto-guardado en Selección de Formatos (`CreateTicketModal.tsx`):** Se corrigió el handler `onClick` al seleccionar/deseleccionar formatos y tipos de entregables (`tiposContenido` y `ticketTypeId`) en la ventana emergente para que active `triggerImmediateAutoSave` inmediatamente.
  2. **Persistencia Garantizada al Cerrar Modal:** Se actualizó `handleClose` para forzar la ejecución de `performAutoSave()` en caso de haber escrituras o cambios pendientes antes de cerrar la ventana emergente.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) verificada exitosamente (0 errores).

### [2026-08-19] — Alta y Asignación de Área al Equipo de Diseño (nh, so, ns)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Alta / Actualización en Base de Datos:** Creación de las áreas `Diseño` y `Contenido` en la base de datos de PostgreSQL/Supabase.
  2. **Asignación del Equipo de Diseño:** Actualización de los usuarios `nh@ontherocks.tech` (Natalia Heit), `so@ontherocks.tech` (Sofía Ottonello) y `ns@ontherocks.tech` (Nahuel Silvestro), asignándoles el `areaId` correspondiente al área `Diseño`.
  3. **Actualización de Seeder (`seed.ts`):** Inclusión de los 3 usuarios de diseño con `upsert` asignando el área `Diseño` para que cualquier re-ejecución del seeder preserve los permisos y área del equipo.
- **Verificación:** Verificación directa contra la base de datos de producción comprobada con 100% de éxito.

### [2026-08-13] — Botón "Pasar a [próximo estado]" + Dropdown en Modal Popup de Ticket
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Reutilización de Lógica de Estados (`lib/estados.ts`):** Se centralizó la lógica de transiciones de estado (`getNextStatusInfo`, `STATUS_OPTIONS`, `PRENSA_STATUS_OPTIONS`) en `lib/estados.ts`.
  2. **Botón Dividido en Modal (`CreateTicketModal.tsx`):** Al abrir/editar un ticket existente desde el popup modal, se incorporó en el footer el botón primario `Pasar a [próximo estado]` junto con el dropdown desplegable para cambiar a cualquier otro estado directamente sin necesidad de navegar a la página del ticket.
  3. **Auto-actualización Instantánea:** Al cambiar de estado desde el modal popup, se actualiza el estado local y se sincroniza con el backend e invalidan las queries del kanban de forma transparente.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente con 0 errores.

### [2026-08-13] — Tipos de Entregable "News" y "Blog" en Tarjetas de Tareas
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Nuevos Tipos de Entregable Tarea (DB & Migration):** Migración idempotente (`20260813190000_add_news_blog_task_types`) y actualización de seeders (`seed-prensa.ts`) para dar de alta "News" y "Blog" con `kind = TAREA` en la tabla `ticket_types`.
  2. **Modal de Creación y Edición (`CreateTicketModal.tsx`):** "News" y "Blog" aparecen automáticamente disponibles como tipo de entregable al seleccionar la pestaña Tareas.
  3. **Corrección e Integración en Sumario (`SumarioTab.tsx`):** Se corrigió la lista de opciones del selector de tipo de tarea (`row.isTarea ? tareaFormatos : formatos`) para listar todos los tipos de tarea configurados y se actualizó la leyenda informativa.
  4. **Estética de Tarjetas (`BacklogPage.tsx`):** Se ajustaron los chips de `tiposContenido` en tarjetas de Tareas para usar tonos oscuros/neutrales acordes a la estética visual de Tareas.
- **Verificación:** `pnpm db:push`, `pnpm seed:prensa` y compilación TypeScript (`pnpm --filter web build`) completados exitosamente sin errores.

### [2026-08-13] — Soporte de Edición de Texto Enriquecido (Bold, Itálica, Listas) en Copy de Tickets
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Edición Rica en Modal (`CreateTicketModal.tsx`):** Se reemplazó el `<textarea>` del copy por el editor enriquecido `RichNotesEditor`, permitiendo editar formato negrita, cursiva, subrayado, tachado, listas, títulos, links e imágenes en la ventana emergente de edición de ticket.
  2. **Edición Rica en Ticket Completo (`TicketDetallePage.tsx`):** Se reemplazó la visualización estática `<pre>` del copy por `RichNotesEditor` interactivo, permitiendo a los usuarios redactar y ajustar el formato directamente desde la vista completa del ticket `/piezas/:id` con auto-guardado en `onBlur`.
  3. **Soporte en Modal del Sumario (`SumarioTab.tsx`):** Se integró `RichNotesEditor` en la vista de edición rápida del copy del Sumario.
  4. **Copiado Limpio a Portapapeles (`copyHtmlToClipboard`):** Helper en `utils.ts` que convierte el HTML a texto plano con saltos de línea al presionar el botón "Copiar", garantizando un pegado impecable en LinkedIn, Instagram, X/Twitter y WhatsApp sin etiquetas HTML.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente con 0 errores.

### [2026-08-06] — Rediseño de Notas de Diseño (Lienzo Sábana Blanca Notion + Control de Imágenes Flotante)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Estética de Lienzo Sábana Blanca Notion:** Rediseño del contenedor en `RichNotesEditor.tsx` reemplazando marcos grises por una hoja limpia y libre con tipografía e interlineado relajado.
  2. **Barra Flotante Contextual de Imágenes:** Al hacer clic en cualquier imagen del editor, aparece una mini-barra flotante para alinear (Izquierda, Centro, Derecha), redimensionar rápidamente por porcentaje (25%, 50%, 75%, 100%) o eliminar.
  3. **Pegado Rico Transparente:** Parser de HTML para pegado desde Notion, ChatGPT, Google Docs o Figma manteniendo títulos, negritas, listas y links impecables.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) exitosa (0 errores).

### [2026-08-06] — Auto-selección de Cliente Activo al Crear Tareas/Tickets
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Prop `defaultClientId` en Modal:** Se añadió soporte para `defaultClientId` en `CreateTicketModalProps` e inicialización dinámica en `buildFormData` y `useEffect`.
  2. **Integración con Filtros de Backlog y Prensa:** `BacklogPage.tsx` y `PrensaBacklogPage.tsx` pasan automáticamente el cliente activo filtrado (`clientesSeleccionados`) al presionar "Nueva".
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) exitosa (0 errores).

### [2026-08-04] — Fase 1: Editor de Notas de Diseño Rico (Notion Paste) + Multi-Formato por Ticket
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Consolidación de Input Único:** Se eliminó la tarjeta duplicada residual en `TicketDetallePage.tsx`, dejando un **único apartado oficial de "Notas de diseño"**.
  2. **Editor de Texto Enriquecido (`RichNotesEditor.tsx`):** Creación del editor enriquecido que permite pegar texto formateado directamente desde **Notion, Google Docs, Word o ChatGPT** manteniendo intactas negritas, listas de viñetas, títulos y saltos de línea.
  3. **Selector Desplegable Multi-Formato:** Selector desplegable con checkboxes en `CreateTicketModal.tsx` para elegir 1 formato con 1 clic o agrupar múltiples variantes en 1 mismo ticket.
  4. **Popup de Pase a Diseño (`TransitionToDesignModal.tsx`):** Al mover tarjetas a la etapa `Diseño`, aparece el modal emergente con el nuevo `RichNotesEditor` para cargar o revisar notas.
- **Verificación:** Compilación TypeScript completa (`pnpm --filter web build`) aprobada exitosamente con 0 errores.

### [2026-07-31] — Orden Cronológico Estricto en Botones de Filtro de Mes (Backlog Contenido y Prensa)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Orden Cronológico Lógico:** Se ordenaron los botones de mes de más antiguo a más nuevo (**Mayo 2026** -> **Junio 2026** -> **Julio 2026** -> **Agosto 2026**), garantizando una secuencia natural de lectura de izquierda a derecha.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Filtros de Mes Toggle en Backlog (Contenido y Prensa) + Remoción de "Crear y Redactar"
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Inclusión del Próximo Mes (M+1):** Se garantizó la presencia del próximo mes (ej: **Agosto**) en la barra de filtros de fecha de los backlogs de Contenido (`/backlog`) y Prensa (`/prensa`).
  2. **Selección Múltiple tipo Toggle:** Los botones de mes ahora funcionan como toggles independientes, permitiendo seleccionar varios meses en simultáneo (ej: `Julio` + `Agosto`) para ver contenidos acumulados de ambos períodos.
  3. **Remoción de "Crear y redactar":** Se removió la opción "Crear y redactar" del modal de creación de ticket de contenido, simplificando la acción principal a **"Crear"** (o **"Crear y ver ticket"**).
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — UX de Popups de Creación/Edición: Botón "Crear / Guardar y Ver Ticket" con Redirección Automática
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Rediseño de Acciones del Footer:** Se retiró el enlace deshabilitado "Ver completo" del extremo izquierdo sin peso visual.
  2. **Botón con Peso Visual y Redirección Directa:** Se añadió el botón destacado **"Crear y ver ticket"** / **"Guardar y ver ticket"** (`ExternalLink`) que guarda/crea la pieza, tarea o ticket de prensa y redirige inmediatamente al usuario a la pantalla completa del ticket (`/piezas/${id}`).
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Remoción de Scrollbar Innecesario en Barra de Pestañas (Marca y Voceros)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Flex-Wrap sin Scrollbar:** Se reemplazó `overflow-x-auto` por `flex-wrap` en la barra de pestañas (Marca / Voceros), eliminando el track de desplazamiento horizontal sobrante.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Popovers Inline Independientes para "Copiar a Vocero(s)" y "Copiar a Red(es)" (Sin Popups)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Dos Botones Independientes:** Se separó la acción de copiado masivo en 2 botones directos en la barra flotante de selección: **"Copiar a Vocero(s)"** y **"Copiar a Red(es)"**.
  2. **Desplegables Popover Inline (sin modal ni popup):** Al hacer click en cualquiera de los dos botones, se despliega un popover flotante directo sobre el botón con los checkboxes de selección y el botón **Copiar**.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Ajuste de Título en Sección de Tareas (sin emojis)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Ajuste de Encabezado:** Se simplificó el título de la sección secundaria a **"Tareas (no publicables) (N)"**, removiendo emojis y manteniendo el estilo limpio de la plataforma.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Copiado Múltiple Cruzado hacia Otras Redes Sociales y Voceros (con fecha vacía)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Duplicación Multicanal:** Se expandió el modal de copiado masivo (**"Copiar a Vocero / Red..."**) para permitir seleccionar **Redes Sociales de Destino** (`LinkedIn`, `Twitter / X`, `Instagram`, `TikTok`, `Blog`, `Newsletters`).
  2. **Combinaciones Cruzadas:** Permite clonar ideas entre redes y entre cuentas al mismo tiempo (ej: copiar 3 contenidos de LinkedIn Marca hacia Instagram y Twitter/X de Mili).
  3. **Fecha Vacía por Defecto:** Todas las piezas duplicadas nacen con la fecha de publicación vacía (`plannedDate: null`), manteniéndose visibles en la tabla para ser agendadas cuando corresponda.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-08-13] — Múltiples Responsables por Tarea / Ticket con Formato Notion
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Modelo de Datos y Schemas:** Se agregó el campo `assigneeIds String[] @default([])` en el modelo `Ticket` de Prisma (`schema.prisma`) y se actualizaron los tipos e interfaces compartidas (`@otr/types` y `@otr/schemas`) manteniendo compatibilidad con `ownerId`.
  2. **API Backend (`apps/api/src/routes/tickets.ts`):** Se incorporó el helper `attachAssignees` para guardar, actualizar y devolver el arreglo `assignees: User[]` enriquecido en las respuestas `GET`, `POST` y `PATCH`.
  3. **Componente Selector Estilo Notion (`ResponsablesSelect.tsx`):** Se implementó un selector multi-responsable de estética Notion con etiquetas/badges contiguas (avatar con iniciales, nombre y botón `x` de remoción) más popover desplegable con buscador.
  4. **Integración en Pantallas y Tableros:** Se actualizaron `CreateTicketModal.tsx`, `TicketDetallePage.tsx`, `BacklogPage.tsx` (cards kanban), `PrensaBacklogPage.tsx` y `CalendarioBacklog.tsx` para seleccionar y visualizar múltiples responsables.
- **Verificación:** Typecheck de TypeScript verificado exitosamente en todo el monorepo (`pnpm typecheck` exited 0) y migración aplicada en PostgreSQL.

### [2026-08-13] — Separación de "Imagen" y "Placa con diseño" como Tipos de Contenido Distintos
- **Desarrollador:** Antigravity (Pair Programming con Javier Sculli)
- **Resumen de Avances:**
  1. **Tipos de Contenido Independientes:** Se separaron formalmente los formatos **"Imagen"** (foto / imagen estática sin diseño gráfico) y **"Placa con diseño"** (gráfica / placa de diseño) en el motor de workflow (`apps/web/src/lib/workflow.ts`).
  2. **Reglas de Workflow Diferenciadas:**
     - **Imagen:** `requiresDesign` evalúa a `false`, permitiendo saltear las etapas de Diseño y Edición (`REDACCION -> REVISION_INTERNA`).
     - **Placa con diseño:** `requiresDesign` evalúa a `true`, asegurando el paso secuencial por la etapa de Diseño Gráfico (`REDACCION -> DISENO -> REVISION_INTERNA`).
  3. **Seeds de la Base de Datos:** Se actualizaron los datos semilla (`apps/api/prisma/seed.ts`) para incluir explícitamente `Imagen` y `Placa con diseño` entre los `TicketType` de tipo `CONTENIDO`.
- **Verificación:** Typecheck y compilación validados correctamente.

### [2026-07-31] — Fix: Asignación de Fecha al Período Activo en Copias (Caso Andén / Mili)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Asignación al Período Activo:** Se actualizó la función de clonación (`getCopyPlannedDate`) para que cualquier nueva copia (individual o masiva) asigne automáticamente su `plannedDate` al mes que estás viendo en la pantalla (`periodo`, ej. Agosto 2026). Esto evita que las copias "desaparezcan" por haber heredado meses anteriores de la pieza original.
  2. **Recuperación de Contenidos de Mili (Andén):** Se actualizaron las 3 piezas duplicadas de Mili para el cliente Andén directamente en la base de datos para que aparezcan en Agosto 2026.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) verificada y base de datos actualizada.

### [2026-07-31] — Copiado Múltiple de Contenidos a Vocero(s)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Acción Masiva "Copiar a Vocero(s)...":** Se incorporó el botón de copia masiva en la barra flotante de selección (ubicado inmediatamente al lado del botón de *Eliminar*).
  2. **Modal Selección Multi-Destino:** Permite seleccionar uno o varios voceros de destino (o la Marca) simultáneamente para clonar N contenidos seleccionados a la vez.
  3. **Preservación Total de Atributos:** Al clonar las piezas, se conservan exactamente la red social (canal), fecha de publicación, tema/brief, formato, pilar, copy completo y referencias/links.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Reordenamiento de Filas vía Drag and Drop (Arrastrar y Soltar)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Arrastrar y Soltar con Mouse:** Se implementó soporte nativo Drag & Drop en las filas de la tabla. Al hacer click sostenido y arrastrar en el manubrio de reordenar (`GripVertical`), la fila se desplaza a la posición deseada sin necesidad de usar botones de flechas.
  2. **Feedback Visual de Arrastre:** Se incorporó un estado semi-transparente en la fila en movimiento (`opacity-40 border-dashed border-[#024fff]`) y una línea de inserción azul en el destino.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-08-18] — Optimización de Rendimiento en Carga de Tarjetas y Guardado (Popup & Tickets)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Eliminación de Sobre-Invalidación de Caché (`invalidateQueries`):** Se removió el re-fetching masivo por red del listado completo de tickets en cada parche de autoguardado en `CreateTicketModal`, `TicketDetallePage` y `ContentPage`.
  2. **Actualización Optimista y Caché Directo (`setQueryData`):** Las mutaciones y auto-saves de tickets ahora actualizan directamente el estado local en React Query, otorgando respuesta instantánea al usuario sin latencia de red.
  3. **Optimización de Carga Útil en Backend (`GET /tickets`):** Se restringió la consulta `findMany` en `tickets.ts` para omitir campos de JSON masivos (`chatHistory` y `versionsPerCanal`) en la vista de listado, reduciendo drásticamente el tamaño del payload.
  4. **Índices de Base de Datos (Prisma):** Se agregaron índices compuestos `@@index([isDraftPlan, area])` y `@@index([isDraftPlan, createdAt])` al modelo `Ticket` en `schema.prisma`.
  5. **Notificaciones Asincrónicas y Eliminación de Búsquedas DB Redundantes:** En `PATCH /tickets/:id`, la creación de notificaciones ahora es asincrónica y en lote (`createMany`), liberando la respuesta HTTP inmediatamente. Además, `attachAssignees` reutiliza los usuarios ya cargados (`owner`/`reviewer`) evitando consultas extras a PostgreSQL.
  6. **Reducción Crítica de Payload de 31MB a 0.7MB (Reducción del 97%):** Se detectó que las columnas de notas con imágenes base64 (`notasGrafica` y `notasAudiovisual`) inflaban la respuesta de `GET /tickets` a **31 Megabytes** por llamada. Al omitir estas columnas pesadas del listado general (se leen solo al abrir la pieza/ticket individual), la respuesta HTTP pasó de 31 MB a solo 0,7 MB, reduciendo la transferencia de 7 segundos a milisegundos.
  7. **Consultas Paralelas en Backend (`Promise.all`):** Se reestructuró la resolución de catálogos y tickets en `GET /tickets` para ejecutarse en paralelo de forma concurrente, reduciendo el tiempo de resolución en base de datos ante un Cache MISS a la mitad.
  8. **Ajuste de Intervalo de Notificaciones y Optimización de PATCH:** Se modificó el polling de notificaciones en el frontend (`Layout.tsx`) a 1 minuto (60.000 ms) y se refactorizó `PATCH /tickets/:id` a una consulta de actualización directa de una sola pasada en PostgreSQL con resolución en memoria de usuarios asignados.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build` y `pnpm --filter api build`) aprobada exitosamente.

### [2026-08-04] — Normalización y Formateo Absoluto de URLs/Links en Tickets
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Helper `ensureAbsoluteUrl`:** Se implementó una función centralizada en `apps/web/src/lib/utils.ts` que valida si una URL contiene un esquema (`http://`, `https://`, `mailto:`, `tel:`). En caso contrario (ej. `infobae.com` o `www.infobae.com`), le antepone `https://` automáticamente.
  2. **Normalización en Creación, Edición y Render:** Se aplicó la normalización en los flujos de tickets (`CreateTicketModal`, `TicketDetallePage`, `ContentPage`, `PublicationDetailPage`), asegurando que los enlaces `<a href="...">` abran correctamente la URL externa en una nueva pestaña sin resolverse como rutas relativas de OTR (`/backlog/infobae.com`).
- **Verificación:** Typecheck (`pnpm --filter web typecheck`) y build de producción (`pnpm --filter web build`) aprobados exitosamente.

### [2026-07-31] — Badges Coloreados para Plataforma y Pilar en Sumario
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Badges de Red Social / Plataforma:** Los selectores de plataforma (LinkedIn, Twitter/X, Instagram, TikTok, Blog, Newsletter) ahora se presentan como píldoras / badges con colores distintivos oficiales por red social (ej. Azul LinkedIn, Rosa Instagram, Esmeralda Blog, Púrpura Newsletter).
  2. **Badges de Pilar de Contenido:** El selector de Pilar de contenido también adopta un estilo de badge coloreado dinámico según el pilar asignado, mejorando significativamente la distinción visual al recorrer la tabla.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Agrupamiento Individual por Red Social (sin emojis) en Sumario
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Secciones por Red Social Individual:** Se dividieron los contenidos en secciones separadas por red social (`LinkedIn`, `Twitter / X`, `Instagram`, `TikTok`, `Blog & Artículos`, `Newsletters`).
  2. **Diseño sobrio y limpio:** Se eliminaron los emojis de los títulos de las secciones para mantener una estética profesional y sobria.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente.

### [2026-07-31] — Corrección de Alineación de Columnas y Truncamiento de Copy en Sumario
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Alineación de Columnas (1:1):** Se asignaron clases de ancho exactas e idénticas en los `<th>` del header y los `<td>` de las celdas, corrigiendo el despasaje entre encabezados y filas.
  2. **Vista Previa de Copy Chica y Truncada:** Se fijó el botón de la columna *Copy* a un ancho máximo estricto (`w-[120px]` / `max-w-[104px]` con `truncate text-ellipsis overflow-hidden`), evitando que copies largos estiren la tabla o generen un scroll horizontal excesivo.
  3. **Estructura HTML limpia:** Se unificó la tabla con un único `<tbody>` que contiene los rows planos y divisores de categorías.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente sin errores.

### [2026-07-31] — Ajuste de UX: Selector Único de Mes (hasta M+1) y Tabla Dedicada de Tareas
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Selector Único de Mes (UX):** Se simplificó el selector de período a un dropdown de selección **única** (que muestra hasta `M+1`, ej. Agosto 2026), removiendo el filtro multi-check para mejor usabilidad.
  2. **Tabla Dedicada de Tareas (SUM-04 Refinement):** Se removieron los toggles de "Ver Tareas" y "Vista Plana". Ahora las tareas no-publicables (reportes, decks, estrategia) se muestran **siempre** de forma continua en su propia tabla dedicada (📋 *Tareas del Mes*) ubicada inmediatamente debajo de la tabla principal de Contenidos.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) verificada exitosamente.

### [2026-07-31] — Resoluciones de Épicas 1 y 2 (Bugs y Mejoras de Sumario)
- **Desarrollador:** Javier Sculli
- **Resumen de Avances:**
  1. **Selector de Meses (BUG-01):** Habilitada navegación dinámica que incluye automáticamente hasta el mes siguiente al actual (`M+1`, ej. Agosto 2026), cumpliendo con la regla estricta.
  2. **Leak de Draper (BUG-02):** Implementada validación estricta por `clientId` en la renderización del Sumario para prevenir la aparición de ítems de otros clientes.
  3. **Secciones de Sumario (SUM-02):** Implementado agrupamiento por categorías (📱 Redes Sociales, 📝 Blog y 📧 Newsletters).
  4. **Reordenamiento Manual (SUM-03):** Agregados controles ▲ y ▼ en cada fila para reordenar dinámicamente contenidos.
  5. **Duplicar Filas (SUM-05):** Añadida acción de clonación rápida de filas entre la 🏢 Marca y los 👤 Voceros del cliente.
- **Verificación:** Compilación TypeScript (`pnpm --filter web build`) aprobada exitosamente sin errores.

### [2026-07-31] — Creación de Bitácora de Proyecto & Estructuración de Backlog
- **Acción:** Creación del archivo oficial de Bitácora del proyecto (`docs/BITACORA.md`).
- **Resumen:** Se compilaron y categorizaron todas las minutas de la reunión estratégica (Sumario, Pilares por Vocero, Bugs de Filtrado/Fechas, Flujos de Trabajo, Integración IA y Transición de Herramientas).
- **Próximos pasos inmediatos (Javier):** Implementación de correcciones en Sumario (Bug Fechas Agosto + Filter Draper), soporte de Pilares por Vocero y ajustes visuales de tickets.

---
