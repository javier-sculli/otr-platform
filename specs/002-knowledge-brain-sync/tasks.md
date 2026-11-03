# Tasks: Zero-Form Upload, Brand Pulse Dashboard, and Brand Kit Audit & Sync

**Feature Branch**: `002-knowledge-brain-sync`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Status**: Completed & Verified (100% Tests Green)

---

## Phase 1: Setup & Shared Types

- [x] **T001**: Exportar interfaces en `packages/types/src/knowledge.ts`:
  - `BrandPulseResponse` (`adn`, `hitosRecientes`, `salud`)
  - `AuditBrandKitResponse` (`gaps`, `proposedBrandVoice`, `analysisSummary`)
  - `UploadInferredDTO` & tipos para subida Zero-Form.

---

## Phase 2: User Story 1 - Ingesta "Zero-Form" Asistida por IA (P1)

- [x] **T002**: Implementar endpoint `POST /knowledge/upload-inferred` en `apps/api/src/routes/knowledge.ts` (acepta archivo o texto, invoca Claude para inferir título, tipo, relevancia, resumen y tags, y persiste en `KnowledgeDocument`).
- [x] **T003**: Agregar cliente API `uploadInferredDocument` en `apps/web/src/lib/api.ts`.
- [x] **T004**: Crear componente `ZeroFormDropzone.tsx` en `apps/web/src/components/knowledge/` con soporte para Drag & Drop y pegado directo de texto, con estado de loading inteligente.
- [x] **T005**: Integrar `ZeroFormDropzone` en `KnowledgeBasePage.tsx` con invalidación de caché React Query tras la carga.
- [x] **T006**: Agregar tests automatizados para `upload-inferred` (`ZeroFormDropzone.test.tsx`).

---

## Phase 3: User Story 2 - Tablero "Brand Pulse" (P2)

- [x] **T007**: Implementar endpoint `GET /knowledge/brand-pulse` en `apps/api/src/routes/knowledge.ts` (sintetiza ADN, 3 hitos del mes y métricas de salud del cliente).
- [x] **T008**: Agregar cliente API `getBrandPulse` en `apps/web/src/lib/api.ts`.
- [x] **T009**: Crear componente `BrandPulseHeader.tsx` en `apps/web/src/components/knowledge/` con diseño moderno, badges de foco y métricas de salud.
- [x] **T010**: Renderizar `BrandPulseHeader` al tope de `KnowledgeBasePage.tsx`.

---

## Phase 4: User Story 3 - Auditoría y Sincronización de Brand Kit (P3)

- [x] **T011**: Implementar endpoint `POST /knowledge/audit-brand-kit` en `apps/api/src/routes/knowledge.ts` (cruza `BrandVoice` con últimos documentos y devuelve brechas y propuesta de actualización).
- [x] **T012**: Implementar endpoint `POST /knowledge/apply-brand-kit` en `apps/api/src/routes/knowledge.ts` (actualiza `BrandVoice` del cliente con las sugerencias seleccionadas).
- [x] **T013**: Crear drawer interactivo `BrandKitAuditDrawer.tsx` en `apps/web/src/components/knowledge/` mostrando hallazgos, diff de campos y botón "Aplicar al Brand Kit".
- [x] **T014**: Conectar botón "Auditar Brand Kit" en el encabezado de Cerebro y en `BrandPulseHeader`.

---

## Phase 5: Verification & Governance

- [x] **T015**: Probar endpoints en vivo con cliente activo (Cámara Fintech).
- [x] **T016**: Ejecutar suite completa `pnpm --filter web test` y verificar 100% verde (32 test files, 269 tests).
- [x] **T017**: Registrar avance en `docs/BITACORA.md`.
