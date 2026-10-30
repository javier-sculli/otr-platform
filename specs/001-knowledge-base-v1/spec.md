# Feature Specification: Knowledge Base V1 (Cerebro de Clientes & Voceros)

**Feature Branch**: `001-knowledge-base-v1`  
**Created**: 2026-10-29  
**Status**: Draft / Ready for Review  
**Input**: Consolidación de base de conocimiento viva para cada cliente y sus voceros, ingesta fluida (reuniones, Google Meet, documentos, feedback, chats de Claude), chat asistente Q&A con la base de datos, conexión vía MCP e inyección de contexto vivo al motor de redacción de Rocky.

---

## Business Problem & Context

Actualmente, el equipo de redacción de On The Rocks (OTR) termina redactando piezas en conversaciones externas de Claude en lugar de usar Rocky. Esto ocurre porque:
1. **El Brand Kit actual es rígido y estático**: Consta de 11 campos fijos para marcas y 9 para voceros en la base de datos relacional. Rara vez se actualiza tras llamadas o interacciones semanales.
2. **Falta memoria episódica viva**: El contexto real (transcripciones de Google Meet, feedback semanal del cliente sobre qué no le gustó, nuevos decks, hitos de la empresa) queda atrapado en hilos gigantescos de Claude o en la cabeza de los redactores.
3. **El motor de IA de Rocky redacta con contexto desactualizado**: Al no tener este flujo de contexto, los primeros borradores generados por Rocky pierden frente a Claude, obligando a rehacer el trabajo afuera.

**Objetivo de la V1**:
Implementar un sistema centralizado, flexible y de baja fricción ("Cajón Inteligente") que permita consolidar documentos y notas por cliente/vocero, consultarlos en lenguaje natural mediante un chat asistente con la base de datos, alimentarlos desde la web o directamente desde Claude vía MCP, e inyectar ese contexto vivo en la redacción de piezas en Rocky.

---

## User Scenarios & Prioritized User Stories

### User Story 1 - Ver y Navegar la Base de Conocimiento Consolidada (Priority: P1)

Como redactor o coordinador de cuentas de OTR, quiero acceder a una sección dedicada a la Base de Conocimiento de un cliente y ver todos sus documentos, notas, reuniones y feedback ordenados en un único lugar, para entender en pocos segundos el estado de la cuenta sin buscar en chats dispersos o carpetas de Drive.

**Why this priority**: Es la base visible indispensable sobre la cual opera todo el sistema de conocimiento. Sin esta pantalla, no hay transparencia ni verificación de qué información existe.

**Independent Test**: Puede probarse creando documentos de prueba (una reunión y un feedback) y verificando que se listan con filtros por tipo, fecha y vocero en la UI de Rocky.

**Acceptance Scenarios**:
1. **Given** un cliente seleccionado con 5 documentos cargados de distintos tipos (`REUNION`, `FEEDBACK`, `DOCUMENTO`), **When** el usuario navega a la sección de Knowledge Base, **Then** visualiza la lista ordenada cronológicamente (más recientes primero) con título, fecha, tipo (badge visual) y vocero asociado (si aplica).
2. **Given** la lista de documentos de un cliente, **When** el usuario filtra por tipo `FEEDBACK` o escribe un término en el buscador, **Then** la lista filtra instantáneamente sin recargar la página.
3. **Given** un documento en la lista, **When** el usuario hace click en él, **Then** se abre una vista de lectura rápida (drawer o modal) mostrando el contenido completo y sus metadatos.

---

### User Story 2 - Ingesta Rápida Manual y Asistida (Modal & Google Meet) (Priority: P2)

Como contenidista, quiero poder cargar rápidamente una transcripción de reunión (de Google Meet o Granola) o una nota de feedback con un simple "copiar y pegar", obteniendo una síntesis automática de la IA y asignación de tipo sin tener que llenar 10 campos aburridos.

**Why this priority**: Si cargar información requiere más de 30 segundos, el equipo no lo va a hacer en el día a día. La baja fricción es crítica para el éxito del producto.

**Independent Test**: Se pega una transcripción cruda de Google Meet de 20 párrafos en el modal "+ Cargar Documento"; la IA sugiere título, tipo `REUNION` y un resumen ejecutivo en viñetas que se persiste en la base.

**Acceptance Scenarios**:
1. **Given** el modal "+ Agregar a Base de Conocimiento", **When** el usuario pega texto libre y presiona "Analizar con IA", **Then** el sistema sugiere automáticamente: Título conciso, Tipo (`REUNION`, `FEEDBACK`, `DOCUMENTO` o `NOTA`), y un Resumen ejecutivo de 3 bullets.
2. **Given** la sugerencia generada, **When** el usuario confirma la carga, **Then** el documento se guarda en la base de datos asociado al cliente (y vocero opcional) y aparece inmediatamente en la tabla.
3. **Given** un texto largo de Google Meet con ruido de charla informal, **When** la IA extrae los puntos clave, **Then** prioriza: decisiones tomadas, temas de negocio tratados y preferencias de comunicación mencionadas por el cliente.

---

### User Story 3 - Chat Asistente con la Base del Cliente ("Preguntale al Cliente") (Priority: P3)

Como redactor o estratega de OTR, quiero abrir un chat lateral en la Knowledge Base y hacer preguntas abiertas a la información cargada del cliente (utilizando el mismo modelo Claude Sonnet de redacción), para resolver dudas editoriales y recordar decisiones previas al instante.

**Why this priority**: Transforma la base de conocimiento de un "cementerio de documentos" a un asistente interactivo inteligente.

**Independent Test**: Se realizan consultas como *"¿Qué dijo el cliente sobre precios en la última reunión?"* o *"¿Cuáles son las reglas de tono que no debemos violar?"* y la IA responde sintetizando los documentos cargados, citando las fuentes.

**Acceptance Scenarios**:
1. **Given** una base de cliente con al menos 2 documentos cargados, **When** el usuario envía una pregunta al chat asistente, **Then** el sistema busca en los documentos del cliente, arma el contexto y Claude responde con tono analítico y preciso.
2. **Given** una respuesta generada por el chat, **When** la respuesta se basa en documentos específicos, **Then** incluye al pie un bloque de fuentes citadas: `[Fuentes: Call semanal (12/10) · Feedback post (05/10)]`.
3. **Given** una pregunta cuya respuesta NO está presente en ningún documento del cliente, **When** la IA evalúa el contexto, **Then** responde honestamente: *"No encontré menciones a ese tema en las reuniones o documentos cargados del cliente"*, evitando alucinaciones.

---

### User Story 4 - Ingesta Inalámbrica desde Claude Desktop/Web vía MCP (Priority: P4)

Como contenidista que está redactando o recibiendo feedback dentro de Claude Desktop (o Slack), quiero poder decirle a Claude *"Guardá este feedback en la base de Rocky para el Cliente X"*, y que el servidor MCP lo persista directamente en Rocky sin que yo tenga que cambiar de ventana.

**Why this priority**: Se mete en el flujo de trabajo donde el equipo ya vive hoy, capturando el valor que hoy se pierde en conversaciones externas.

**Independent Test**: Se invoca la tool MCP `save_knowledge_doc` pasando `{ clientId, title, type, content }` y se valida que el registro exista en Postgres y sea visible en la web de Rocky.

**Acceptance Scenarios**:
1. **Given** Claude conectado al servidor MCP de Rocky (`apps/mcp`), **When** el usuario pide guardar una regla o resumen de reunión, **Then** Claude invoca `save_knowledge_doc` con los parámetros correspondientes.
2. **Given** la ejecución exitosa de la tool MCP, **When** el redactor refresca la pantalla de Rocky, **Then** el nuevo documento aparece registrado con tipo y fecha actuales.

---

### User Story 5 - Inyección de Contexto Vivo en la Redacción de Rocky (Priority: P5)

Como redactor en el Workspace de Rocky (`/piezas/:id`), quiero que cuando presione "Generar borrador con IA", el prompt incluya automáticamente los últimos feedbacks y puntos clave de las reuniones recientes del cliente/vocero, para que el copy generado tenga la misma profundidad y calidad que si lo hubiese escrito en Claude.

**Why this priority**: Cierra el círculo de valor: el conocimiento acumulado alimenta directamente el producto final (la pieza redactada).

**Independent Test**: Se redacta una pieza para un cliente con un feedback reciente que dice *"No usar emojis en la primera línea"*; la pieza generada por Rocky acata estrictamente la regla.

**Acceptance Scenarios**:
1. **Given** un ticket en redacción, **When** se llama a `POST /ai/:ticketId/chat`, **Then** el backend consulta los últimos documentos relevantes (`FEEDBACK` y `REUNION` recientes) del cliente y vocero, y los inyecta en el bloque `## Contexto vivo y reglas recientes`.
2. **Given** la generación de la IA, **When** existen directivas contradictorias entre el Brand Voice estático viejo y un Feedback reciente en Knowledge Base, **Then** el prompt indica explícitamente que los feedbacks recientes tienen prioridad sobre el Brand Voice antiguo.

---

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE proveer un modelo de datos `KnowledgeDocument` asociado a `Client` y opcionalmente a `Speaker`, almacenado en PostgreSQL.
- **FR-002**: El campo `type` de `KnowledgeDocument` DEBE ser un string flexible (no enum rígido), con valores estándar sugeridos en la UI (`REUNION`, `FEEDBACK`, `DOCUMENTO`, `CLAUDE_CHAT`, `NOTA`).
- **FR-003**: El sistema DEBE permitir almacenar arrays de etiquetas libres (`tags: String[]`) por documento.
- **FR-004**: La API de Rocky (`apps/api`) DEBE exponer endpoints seguros (`preHandler: authenticate`) para listar (`GET /knowledge`), crear (`POST /knowledge`), obtener detalle (`GET /knowledge/:id`), actualizar (`PATCH /knowledge/:id`) y eliminar (`DELETE /knowledge/:id`).
- **FR-005**: El backend DEBE exponer un endpoint de análisis y síntesis con IA (`POST /knowledge/analyze`) que reciba texto crudo y devuelva: título sugerido, tipo inferido y resumen en viñetas.
- **FR-006**: El backend DEBE exponer un endpoint de chat asistido (`POST /knowledge/chat`) que acepte `{ clientId, speakerId?, question, history? }` y devuelva la respuesta con citas de documentos.
- **FR-007**: El frontend (`apps/web`) DEBE contar con una página principal accesible desde el menú lateral (`/knowledge-base`) con selector de cliente y visualización de documentos y chat.
- **FR-008**: El servidor MCP (`apps/mcp`) DEBE registrar la tool `save_knowledge_doc` para permitir la ingesta remota desde clientes compatibles con MCP (Claude Desktop, etc.).
- **FR-009**: El generador de IA de tickets (`apps/api/src/routes/ai.ts`) DEBE integrar dinámicamente los documentos de conocimiento más recientes del cliente al construir el system prompt.

### Non-Functional Requirements & Invariants

- **NFR-001 (Performance)**: Las consultas de listado y filtrado de documentos deben responder en menos de 100ms para bases de datos de hasta 10.000 documentos por cliente.
- **NFR-002 (Seguridad)**: Toda consulta de documentos debe estar aislada por sesión y verificar permisos del usuario sobre el cliente respectivo.
- **NFR-003 (Robustez de guardado)**: Si la IA falla en la auto-síntesis al crear un documento, el documento debe guardarse igualmente con los datos provistos por el usuario (graceful degradation).

---

## Edge Cases

- **Texto excesivamente largo**: Si un usuario pega una transcripción de Google Meet de más de 30.000 palabras, el endpoint de análisis debe truncar o procesar en chunks para no desbordar la ventana de contexto ni agotar timeouts HTTP.
- **Documento sin texto o con caracteres vacíos**: La API debe rechazar con 400 Bad Request si el contenido no contiene al menos 10 caracteres válidos.
- **Eliminación en cascada**: Si un cliente es eliminado, todos sus `KnowledgeDocument` asociados deben eliminarse en cascada sin dejar huérfanos (`onDelete: Cascade`).
- **Cliente sin documentos**: El chat asistente debe indicar amablemente que no hay documentos registrados y ofrecer un botón o sugerencia para cargar el primero.

---

## Key Entities

- **`KnowledgeDocument`**:
  - `id`: UUID (Primary Key)
  - `clientId`: UUID (Foreign Key a `Client`)
  - `speakerId`: UUID (Foreign Key opcional a `Speaker`)
  - `title`: String (Título descriptivo del documento)
  - `type`: String (Tipo flexible: 'REUNION', 'FEEDBACK', 'DOCUMENTO', 'NOTA', etc.)
  - `tags`: Array de Strings (Etiquetas temáticas o de canal)
  - `content`: Text (Texto crudo completo de la fuente)
  - `summary`: Text opcional (Resumen ejecutivo sintetizado por IA)
  - `date`: DateTime (Fecha del evento o documento, default now)
  - `sourceUrl`: String opcional (Link externo a Drive, Granola o Meet)
  - `createdAt`, `updatedAt`: Timestamps

---

## Success Criteria

- **SC-001**: El redactor puede ingresar una nueva reunión o feedback en menos de 20 segundos mediante el modal rápido o el chat.
- **SC-002**: Las preguntas realizadas al Chat de Knowledge Base responden en menos de 5 segundos con información verificable en los documentos del cliente.
- **SC-003**: El 100% de los tickets redactados con IA en clientes con Knowledge Base activa incorporan las directivas de los últimos feedbacks sin intervención manual de copiado de reglas.
- **SC-004**: Los redactores reportan no necesitar saltar a Claude externo para redactar el primer borrador de contenido.
