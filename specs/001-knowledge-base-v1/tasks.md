# Tasks: Knowledge Base V1 (Cerebro de Clientes & Voceros)

**Input**: Design documents from `/specs/001-knowledge-base-v1/` (`spec.md`, `plan.md`)  
**Status**: Completed (Verified & Tested)

---

## Phase 1: Setup & Data Foundation (Prerequisites)

- [x] **T001**: Crear modelo `KnowledgeDocument` y relaciones en `apps/api/prisma/schema.prisma`.
- [x] **T002**: Generar y aplicar migración Prisma (`npx prisma migrate dev --name add_knowledge_documents`).
- [x] **T003**: Exportar tipos compartidos en `packages/types/src/knowledge.ts` y exportarlos en el índice del paquete.

---

## Phase 2: User Story 1 - Ver y Navegar la Base de Conocimiento (P1)

- [x] **T004**: Implementar endpoints de lectura `GET /knowledge` y `GET /knowledge/:id` en `apps/api/src/routes/knowledge.ts`.
- [x] **T005**: Registrar rutas de knowledge en `apps/api/src/server.ts`.
- [x] **T006**: Agregar métodos de cliente API en `apps/web/src/lib/api.ts` (`getKnowledgeDocuments`, `getKnowledgeDocumentById`).
- [x] **T007**: Crear página base `KnowledgeBasePage.tsx` en `apps/web/src/pages/` con selector de cliente y tabla/grilla de documentos.
- [x] **T008**: Agregar ruta `/knowledge-base` en `apps/web/src/App.tsx` y acceso en la navegación lateral `Layout.tsx`.
- [x] **T009**: Crear componente drawer/modal de visualización rápida `DocumentDetailDrawer.tsx`.
- [x] **T010**: Agregar test unitario para endpoints de lectura de `knowledge.ts`.

---

## Phase 3: User Story 2 - Ingesta Rápida Manual y Asistida (P2)

- [x] **T011**: Implementar endpoints `POST /knowledge`, `PATCH /knowledge/:id` y `DELETE /knowledge/:id` en `apps/api/src/routes/knowledge.ts`.
- [x] **T012**: Implementar endpoint de síntesis con IA `POST /knowledge/analyze` en `apps/api/src/routes/knowledge.ts` (extrae título, tipo y resumen en bullets).
- [x] **T013**: Crear modal de carga `AddDocumentModal.tsx` en `apps/web/src/components/knowledge/` con tab de entrada manual y botón "Analizar con IA".
- [x] **T014**: Conectar mutaciones de creación/edición/borrado con React Query e invalidación de caché.
- [x] **T015**: Agregar test para validación de datos en creación de documentos y fallback si falla la IA.

---

## Phase 4: User Story 3 - Chat Asistente con la Base del Cliente (P3)

- [x] **T016**: Implementar endpoint `POST /knowledge/chat` en `apps/api/src/routes/knowledge.ts` (combina contexto de documentos del cliente, llamadas a Claude y extracción de citas de fuentes).
- [x] **T017**: Crear componente de chat lateral interactivo `KnowledgeChatPanel.tsx` en `apps/web/src/components/knowledge/`.
- [x] **T018**: Integrar `KnowledgeChatPanel` en `KnowledgeBasePage.tsx` con soporte para historial de mensajes y links a documentos citados.

---

## Phase 5: User Story 4 - Ingesta Inalámbrica vía MCP (P4)

- [x] **T019**: Crear `apps/mcp/src/tools/knowledge.ts` con las tools `save_knowledge_doc` y `search_knowledge`.
- [x] **T020**: Registrar las tools de knowledge en `apps/mcp/src/tools/index.ts`.
- [x] **T021**: Validar la llamada de la tool vía API Client de MCP y verificar persistencia en base de datos.

---

## Phase 6: User Story 5 - Inyección de Contexto Vivo en Redacción (P5)

- [x] **T022**: Modificar `apps/api/src/routes/ai.ts` para consultar dinámicamente los últimos `KnowledgeDocument` de tipo `FEEDBACK` y `REUNION` del cliente/vocero.
- [x] **T023**: Inyectar el bloque de contexto vivo en la función `buildSystemPrompt`.
- [x] **T024**: Agregar test de integración que valide que el prompt enviado al LLM contiene los documentos de knowledge recientes.

---

## Phase 7: Polish & Governance

- [x] **T025**: Registrar la épica y tareas en el Backlog de Notion (`Backlog OTR`).
- [x] **T026**: Asentar el avance y arquitectura en `docs/BITACORA.md` y actualizar `memory/INDEX.md`.
- [x] **T027**: Ejecutar `pnpm test` en todo el monorepo y verificar 100% verde.
