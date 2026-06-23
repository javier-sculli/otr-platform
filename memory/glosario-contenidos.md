# Historia de Usuario: Sumario de Contenidos (Glosario)

**Estado:** ✅ Completamente Implementada y Verificada  
**Fecha:** 2026-06-23  
**Área:** Contenidos (Rocky Platform)  
**Prioridad:** Alta  

---

## 1. Contexto y Problema

Actualmente, el equipo de contenidos de On The Rocks (Manu, Shaiel, Paloma, Augus) realiza la planificación mensual en un **Excel ordenado por fecha**. Este documento es la fuente de verdad inicial y se comparte con los clientes para su revisión y aprobación.

Inconvenientes del proceso actual:
1. **Duplicación de trabajo:** Las contenidistas tienen que transcribir manualmente los planes del Excel hacia los tickets de producción (antes Notion, ahora Rocky).
2. **Diferencias operativas:** Algunas trabajan a demanda (ej. La Cámara), otras necesitan aprobación previa (Pali), y otras lo usan para estructurar sus semanas (Augus).
3. **Control de volumen por red:** Es difícil contabilizar de manera rápida cuántas piezas se están haciendo para cada red social por cliente, lo que suele desalinear las métricas de lo comprometido.

---

## 2. Decisiones de Producto Definidas

En base a las definiciones del equipo y la sesión de alineación con Javi, se establecen las siguientes reglas de negocio:

1. **Ubicación en la UI (Sección General con Selector de Cliente):**
   - El Sumario de Contenidos vivirá en una página dedicada accesible desde la barra de navegación general del header (`/sumario`).
   - Al entrar a la sección, se presentará un dropdown de selección de cliente para cargar el sumario correspondiente.
2. **Aprobación del Cliente (Nueva Columna):**
   - Se creará un campo específico en el ticket para el estado de aprobación por parte del cliente (`estadoAprobacionCliente`), que se representará como una columna editable en la grilla del sumario.
   - Estados posibles: `BORRADOR` (default), `ENVIADO_AL_CLIENTE`, `APROBADO`, `RECHAZADO`, `REQUIERE_AJUSTES`.
3. **Estructura Multicanal (Una fila por canal):**
   - Si una pieza va para múltiples redes, en el Sumario se representará como **filas independientes** (una línea para LinkedIn, otra para Instagram, etc.). Esto permite contar exactamente cuántas piezas se generan por canal y escribir copys específicos.
   - En la base de datos, cada fila corresponderá a un `Ticket` individual con un único canal en su array de `canales`.
4. **Linkeo de Publicación Real (Manual y Opcional):**
   - No se implementará scraping automático ni auto-matching en esta fase inicial.
   - Se habilitará un campo de texto opcional y editable para guardar manualmente el link de publicación real (`linkPublicacionReal`), que se podrá completar durante el proceso de cierre de la pieza.

---

## 3. Especificaciones Funcionales (Criterios de Aceptación)

### Criterio 1: Volumen Mensual y Generación del Sumario
- Se configura en el perfil de cada [Client](file:///Users/javiersculli/dev/OTR/apps/api/prisma/schema.prisma#L43) un **Volumen Mensual de Contenido Comprometido** (ej. 12 piezas por mes).
- Al inicio de un mes (o mediante botón "Inicializar Sumario"), Rocky crea las N filas/tickets vacíos correspondientes, asignando la fecha aproximada en base al calendario de ese mes.

### Criterio 2: Composición del Sumario (Filtro)
- La grilla solo muestra elementos de tipo publicable (`kind = CONTENIDO`), excluyendo de esta pestaña las Tareas de soporte (Decks, Reportes, etc.).

### Criterio 3: Grilla Interactiva (Tab Sumario)
- Una vista estilo hoja de cálculo con columnas de:
  - **Fecha Planificada** (Datepicker inline)
  - **Canal / Red** (Dropdown: LinkedIn, Instagram, Twitter)
  - **Vocero / Pilar** (Dropdowns contextuales al cliente)
  - **Título / Brief** (Input de texto rápido)
  - **Copy Borrador** (Acceso rápido al Workspace)
  - **Estado de Aprobación Cliente** (Dropdown: Borrador / Enviado / Aprobado / Rechazado)
  - **Link Manual de Publicación** (Input opcional)

### Criterio 4: Automatización de Sumario a Backlog (Push Semanal)
- Cada lunes a las 08:00 AM (o mediante un botón "Publicar Plan de la Semana"), los tickets del Sumario de esa semana cambian su estado técnico de `isDraftPlan = true` a `isDraftPlan = false`.
- Esto los hace aparecer automáticamente en la columna `PENDIENTE` del Backlog Kanban para que el equipo empiece a redactar.
- Los cambios aplicados a las tarjetas en el Kanban no alteran la fecha original de planificación del Sumario, manteniendo la auditoría.

### Criterio 5: Flujo Inverso para Contenido a Demanda (Pull)
- Si se crea un contenido de forma imprevisto directo en el Backlog Kanban, al moverse al estado `CERRADO` con motivo `PUBLICADO` se agregará automáticamente al Sumario histórico del mes en curso como una fila adicional.

### Criterio 6: Exportador a Excel
- Botón "Exportar a Excel" en la esquina superior de la pestaña, que descarga un `.xlsx` con la grilla estructurada para enviar directamente al cliente.

---

## 4. Guía de Diseño UI/UX para Figma

Para diseñar esta vista en Figma, se deben considerar las siguientes pantallas, estados e interacciones clave:

### A. Vista Principal (Página "/sumario")
Esta página debe presentar la siguiente jerarquía visual:
1. **Selector de Cliente (Sticky Top):**
   - Una barra superior debajo del header general (`top-[64px]`) con el selector del cliente activo (Dropdown de selección simple).
2. **Cabecera del Sumario (Subheader):**
   - **Selector de Período:** Dropdown para elegir Mes/Año (ej: `Junio 2026`).
   - **Indicador de Avance:** Una barra de progreso o contador que compare: `Piezas Planificadas` vs. `Volumen Comprometido` (ej: **"Planificado: 10 de 12 piezas de este mes"**).
   - **Botón "Exportar Excel":** Con ícono estándar de Excel/Descarga.
   - **Botón "Publicar Semana en Backlog" (o "Push Semanal"):** Un botón prominente para transferir los borradores al backlog real.
2. **Tabla / Grilla de Planificación (Spreadsheet-like):**
   - Una grilla compacta que optimice el espacio vertical (densidad alta, similar a un Excel).
   - Columnas del sumario:
     - **[Fecha Planificada]**: Celda que al hacer click abre un mini-datepicker.
     - **[Canal / Red]**: Celda editable con píldora/ícono de la red social (LinkedIn, Instagram, Twitter).
     - **[Vocero]**: Dropdown con nombres de voceros de ese cliente o la marca principal.
     - **[Pilar]**: Dropdown con los pilares del cliente.
     - **[Título / Tema]**: Input de texto directo para el brief rápido de la pieza.
     - **[Copy]**: Indicador visual de si ya tiene texto (ej: píldora verde "Redactado", o ícono de edición que te lleve al Workspace).
     - **[Aprobación Cliente]**: Select con colores de badges asociados a cada estado:
       - `BORRADOR` (Gris)
       - `ENVIADO_AL_CLIENTE` (Amarillo/Naranja)
       - `APROBADO` (Verde sólido)
       - `RECHAZADO` (Rojo)
       - `REQUIERE_AJUSTES` (Violeta/Azul)
     - **[Link de Publicación]**: Caja de texto para pegar el enlace final.

### B. Estados de la Interfaz
1. **Estado Vacío / No Inicializado (Empty State):**
   - Se muestra cuando un mes nuevo no tiene planificación creada.
   - Ilustración simple y botón: **"Inicializar Sumario de Junio"** (esto genera automáticamente el número de filas configurado en la ficha del cliente).
2. **Fila en Modo Edición / Foco:**
   - Al hacer click en una fila, debe distinguirse visualmente.
   - Idealmente, edición inline superrápida (doble click para escribir el título, selects sencillos para pilar/vocero).
   - Opción para abrir el ticket completo en la barra lateral (drawer/sidebar) mediante un ícono de "Expandir".

---

## 5. Diseño Técnico Propuesto

### Cambios en Prisma Schema (`schema.prisma`):
1. **`Client`**:
   - `monthlyContentTarget Int @default(0) @map("monthly_content_target")`
2. **`Ticket`**:
   - `plannedDate DateTime? @map("planned_date")`
   - `isDraftPlan Boolean @default(false) @map("is_draft_plan")`
   - `publishedAt DateTime? @map("published_at")`
   - `estadoAprobacionCliente EstadoAprobacionCliente @default(BORRADOR) @map("estado_aprobacion_cliente")`
3. **Enum `EstadoAprobacionCliente`** (Nuevo):
   - `BORRADOR`
   - `ENVIADO_AL_CLIENTE`
   - `APROBADO`
   - `RECHAZADO`
   - `REQUIERE_AJUSTES`

---

## 6. Próximos Pasos de Implementación (Post-Diseño)

Una vez que el diseño en Figma esté listo y aprobado por Javi, se procederá a:
1. **Migración de BD:** Correr y aplicar los campos nuevos en Prisma.
2. **Desarrollo Backend:** Endpoint para lectura/escritura en lote de las filas del sumario, exportación a Excel y el script/cron de push semanal.
3. **Desarrollo Frontend:** Construcción de la tabla interactiva en la tab de ClienteDetallePage usando componentes de shadcn (`Table`, `Dropdown`, `Popover`).
