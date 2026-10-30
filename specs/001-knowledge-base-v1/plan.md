# Implementation Plan: Knowledge Base V1

**Branch**: `001-knowledge-base-v1` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-knowledge-base-v1/spec.md`

## Summary

Implementar la infraestructura completa de **Knowledge Base V1** para OTR:
1. **Base de Datos**: Modelo `KnowledgeDocument` en Prisma / PostgreSQL, permitiendo almacenar documentos, minutas de Google Meet, feedbacks y chats con campos flexibles.
2. **Backend API (`apps/api`)**: Endpoints REST para CRUD de documentos, análisis automático con IA (`/analyze`), chat asistente con la base del cliente (`/chat`), e inyección de contexto en la redacción de piezas (`/ai/:ticketId/chat`).
3. **Servidor MCP (`apps/mcp`)**: Tool `save_knowledge_doc` para ingesta remota y sin fricción desde Claude Desktop / Slack.
4. **Frontend (`apps/web`)**: Pantalla `/knowledge-base` con selector de cliente, listado con filtros rápidos, drawer de detalle, modal de carga asistida por IA y panel de Chat Asistente interactivo.

---

## Technical Context

- **Language/Version**: TypeScript 5.x, Node.js 20+
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/api`, `apps/mcp`, `packages/types`, `packages/schemas`)
- **Backend**: Fastify 4.x, Prisma ORM 5.22, PostgreSQL (Railway/Supabase)
- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui, `@tanstack/react-query` v5, `lucide-react`
- **MCP**: `@modelcontextprotocol/sdk` (v1.x)
- **AI Integration**: Anthropic SDK (`@anthropic-ai/sdk`), Claude 3.5 Sonnet
- **Testing**: Vitest + React Testing Library

---

## Constitution Check

- [x] **Spec-Driven First**: Spec completa documentada en `spec.md` con historias de usuario priorizadas (P1 a P5).
- [x] **Test Mandatory**: Se agregarán tests unitarios para las rutas de API de knowledge y componentes de UI críticos.
- [x] **Async Invariants (Sub-100ms)**: Síntesis pesadas de IA corren en endpoints dedicados o asíncronos; las listas de documentos son consultas SQL indexadas directas.
- [x] **Simplicidad Pragmática**: Una sola tabla relacional (`knowledge_documents`) con strings flexibles y tags; sin taxonomías complejas de tópicos ni sobreingeniería de vector DBs separadas.
- [x] **Notion & Bitácora**: Tarea sincronizada con Backlog de Notion y documentada en `docs/BITACORA.md`.

---

## Proposed Changes & Architecture

### 1. Database Schema (`apps/api/prisma/schema.prisma`)

```prisma
model KnowledgeDocument {
  id          String   @id @default(uuid())
  clientId    String   @map("client_id")
  speakerId   String?  @map("speaker_id")
  
  title       String
  type        String   @default("NOTA") // 'REUNION' | 'FEEDBACK' | 'DOCUMENTO' | 'CLAUDE_CHAT' | 'NOTA'
  tags        String[] @default([])
  content     String   @db.Text
  summary     String?  @db.Text
  date        DateTime @default(now())
  sourceUrl   String?  @map("source_url")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  speaker     Speaker? @relation(fields: [speakerId], references: [id], onDelete: SetNull)

  @@index([clientId])
  @@index([speakerId])
  @@index([type])
  @@index([clientId, date])
  @@map("knowledge_documents")
}
```

También agregar la relación inversa en `Client` (`knowledgeDocuments KnowledgeDocument[]`) y `Speaker` (`knowledgeDocuments KnowledgeDocument[]`).

---

### 2. Backend Routes (`apps/api/src/routes/knowledge.ts`)

- `GET /knowledge?clientId=...&speakerId=...&type=...&search=...`: Lista documentos con filtros y orden cronológico descendente.
- `GET /knowledge/:id`: Detalle completo de un documento.
- `POST /knowledge`: Crea un documento nuevo (valida `clientId`, `title`, `content`).
- `PATCH /knowledge/:id`: Actualiza campos (`title`, `type`, `tags`, `content`, `summary`).
- `DELETE /knowledge/:id`: Elimina un documento.
- `POST /knowledge/analyze`: Recibe `{ content: string }`, llama a Claude con prompt de extracción liviano y devuelve `{ title: string, type: string, summary: string, tags: string[] }`.
- `POST /knowledge/chat`: Recibe `{ clientId: string, speakerId?: string, question: string, history?: Message[] }`. Trae los documentos del cliente, arma el prompt y responde con citas a los documentos fuente.

---

### 3. Inyección en Generador de IA (`apps/api/src/routes/ai.ts`)

Modificar `aiRoutes` (`POST /ai/:ticketId/chat`):
- Buscar los últimos 5 `KnowledgeDocument` del cliente (priorizando `FEEDBACK` y `REUNION` recientes).
- Inyectar en el prompt un bloque:
  ```markdown
  ## Contexto vivo y reglas recientes (Knowledge Base)
  ⚠️ PRIORIDAD: Las siguientes notas, reuniones y feedbacks reflejan directivas recientes y tienen prioridad sobre lineamientos antiguos:
  [Documentos formateados con fecha y tipo]
  ```

---

### 4. Servidor MCP (`apps/mcp/src/tools/knowledge.ts`)

Crear `registerKnowledgeTools(server: McpServer)`:
- Tool `save_knowledge_doc`:
  - Input schema:
    - `clientId`: string (requerido)
    - `speakerId`: string (opcional)
    - `title`: string (requerido)
    - `content`: string (requerido)
    - `type`: enum/string (`REUNION`, `FEEDBACK`, `DOCUMENTO`, `CLAUDE_CHAT`, `NOTA`)
    - `summary`: string (opcional)
  - Llama a `POST /knowledge` en `apps/api`.
- Tool `search_knowledge`:
  - Input schema: `clientId`, `query`
  - Llama a `GET /knowledge?clientId=...&search=...`.

---

### 5. Frontend (`apps/web`)

1. **Ruta y Navegación**:
   - Agregar ruta `/knowledge-base` en `apps/web/src/App.tsx`.
   - Agregar item en el menú lateral `Layout.tsx` ("Knowledge Base" con ícono `Brain` o `Database`).
2. **Página Principal (`apps/web/src/pages/KnowledgeBasePage.tsx`)**:
   - Selector de cliente en la cabecera.
   - Pestaña doble o vista combinada:
     - **Columna Izquierda / Central**: Lista y grilla de documentos con filtros rápidos (Pills: `Todos`, `Reuniones`, `Feedbacks`, `Decks`, `Notas`), buscador y botón `+ Agregar Documento`.
     - **Columna Derecha**: Panel colapsable de **Chat Asistente** con historial y streaming/respuestas directas de Claude.
3. **Componentes Clave**:
   - `AddDocumentModal.tsx`: Permite ingresar título, tipo, contenido o pegar transcripción de Google Meet con botón "Analizar con IA" para auto-completar antes de guardar.
   - `DocumentDetailDrawer.tsx`: Permite leer el documento completo, copiar contenido, editar o borrar.
   - `KnowledgeChatPanel.tsx`: Componente de chat con scroll automático, visualización de citas de fuentes y sugerencias rápidas de preguntas.

---

## Verification & Testing Plan

1. **Pruebas de Base de Datos y API**:
   - `apps/api/src/routes/__tests__/knowledge.test.ts`:
     - Test de CRUD completo con autenticación.
     - Test de validación de entradas (error con contenido vacío).
     - Test de filtrado por cliente, tipo y texto.
2. **Pruebas de MCP**:
   - Test de ejecución de la tool `save_knowledge_doc` simulando llamada desde Claude.
3. **Pruebas de Frontend**:
   - Test unitario de renderizado y filtrado en `KnowledgeBasePage`.
   - Test de apertura del modal y llamada a la API de análisis.
4. **Verificación de Integración**:
   - Crear un documento de feedback para un cliente de prueba.
   - Generar un borrador de copy en un ticket de ese cliente y verificar en los logs del prompt que el feedback fue inyectado.
