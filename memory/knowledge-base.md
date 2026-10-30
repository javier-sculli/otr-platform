---
name: knowledge-base
description: Knowledge Base V1 (Cerebro de Clientes & Voceros) — Repositorio consolidado, Chat Q&A con citas, Ingesta Google Meet con IA, Ingesta MCP e inyección de contexto vivo en redacción
metadata:
  type: feature
  status: implemented
  date: 2026-10-29
---

## Qué es
Knowledge Base V1 (nombrada "Cerebro" en la barra de navegación) resuelve el problema de que los redactores terminaban redactando en conversaciones externas de Claude debido a la falta de contexto vivo en Rocky.

Proporciona un repositorio vivo donde volcar transcripciones de reuniones (Google Meet/Granola), feedbacks de clientes, notas y decks, con capacidades de consulta en lenguaje natural (Q&A con citas), auto-completado de campos con IA, ingesta inalámbrica vía MCP desde Claude y alimentación directa al motor de generación de copys.

## Componentes y Arquitectura

1. **Base de Datos (`apps/api/prisma/schema.prisma`)**:
   - `model KnowledgeDocument`: guarda título, tipo (`REUNION`, `FEEDBACK`, `DOCUMENTO`, `CLAUDE_CHAT`, `NOTA`), tags, contenido completo, resumen ejecutivo, fecha de evento y sourceUrl. Relacionado con `Client` y `Speaker`.
   - Migración: `20261029160000_add_knowledge_documents`.

2. **Backend API (`apps/api/src/routes/knowledge.ts`)**:
   - `GET /knowledge`: listado con filtros y búsqueda insensible a mayúsculas/minúsculas.
   - `POST /knowledge`: alta de documentos.
   - `PATCH /knowledge/:id` y `DELETE /knowledge/:id`: edición y borrado.
   - `POST /knowledge/analyze`: auto-extracción con IA (título, tipo, resumen y tags a partir de texto crudo).
   - `POST /knowledge/chat`: consulta interactiva Q&A con citas de documentos.

3. **Inyección en Redacción (`apps/api/src/routes/ai.ts`)**:
   - El endpoint de chat/generación de tickets (`/ai/:ticketId/chat`) consulta los 5 documentos de knowledge más recientes y los inyecta en el prompt con prioridad sobre lineamientos estáticos antiguos.

4. **Servidor MCP (`apps/mcp/src/tools/knowledge.ts`)**:
   - Tools `save_knowledge_doc` y `search_knowledge` para que los usuarios puedan guardar notas o consultar la base directamente desde Claude Desktop / Slack.

5. **Frontend Web (`apps/web`)**:
   - Ruta `/knowledge-base` y acceso "Cerebro" en `Layout.tsx`.
   - `KnowledgeBasePage.tsx`: selector de cliente, listado con filtros por tipo (`TODOS`, `REUNION`, `FEEDBACK`, `DOCUMENTO`, `CLAUDE_CHAT`, `NOTA`), buscador y selector de vocero.
   - `AddDocumentModal.tsx`: modal para pegar transcripts con botón de auto-completado de IA.
   - `DocumentDetailDrawer.tsx`: drawer de lectura, copiado y edición.
   - `KnowledgeChatPanel.tsx`: panel lateral de chat con citas de fuentes clickeables.
