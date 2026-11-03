# Implementation Plan: Zero-Form Upload, Brand Pulse Dashboard, and Brand Kit Audit & Sync

**Branch**: `002-knowledge-brain-sync` | **Spec**: [spec.md](./spec.md) | **Status**: Approved for Execution

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │            Cerebro (Knowledge Base)          │
                      │           /knowledge-base (Frontend)         │
                      └───────┬───────────────────────────────┬──────┘
                              │                               │
                1. Brand Pulse Header (P2)      2. Zero-Form Dropzone (P1)
                (ADN, Hitos del Mes, Cobertura) (Arrastrar PDF, deck, texto)
                              │                               │
                              ▼                               ▼
                      ┌───────────────┐              ┌────────────────┐
                      │ GET /pulse    │              │ POST /upload   │
                      └───────┬───────┘              └────────┬───────┘
                              │                               │
                              │ Claude Sonnet 5 Inferencia    │ (Infiere título, tipo,
                              │ rápida de ADN & Hitos         │  relevancia, resumen)
                              ▼                               ▼
                      ┌───────────────────────────────────────────────┐
                      │              PostgreSQL Database              │
                      │ - knowledge_documents                         │
                      │ - brand_voices (11 campos de Brand Kit)       │
                      └───────────────────────┬───────────────────────┘
                                              │
                               3. Audit & Sync (P3)
                               - Audita brechas Brand Kit vs Cerebro
                               - "Aplicar al Brand Kit" con 1 click
                                              ▼
                      ┌───────────────────────────────────────────────┐
                      │       Redactor de Tickets de Rocky (IA)       │
                      │   (Prompt alimentado con Brand Kit + Cerebro) │
                      └───────────────────────────────────────────────┘
```

---

## Technical Specifications

### 1. Ingesta Zero-Form (`POST /knowledge/upload-inferred`)
- Acepta texto crudo o archivos (PDF, Markdown, Texto).
- Si es PDF, se envía como documento base64 nativo a `claude-sonnet-5` (o se extrae el texto).
- Prompt de inferencia estructurado:
  - `title`: Título ejecutivo.
  - `type`: `BRAND_GUIDELINES`, `DESIGN_SYSTEM`, `DECK`, `REUNION`, `FEEDBACK`, `DOCUMENTO`.
  - `relevance`: `ESTRATEGICO` | `TACTICO` | `OPERATIVO`.
  - `summary`: 2-3 bullets concisos.
  - `tags`: Array de hasta 4 tags.
- Se persiste inmediatamente en `KnowledgeDocument` con tag `relevancia:${relevance.toLowerCase()}`.
- Retorna el documento creado para actualizar la UI sin recargar.

### 2. Tablero "Brand Pulse" (`GET /knowledge/brand-pulse?clientId=...`)
- Trae el `brandVoice` actual + los 10 documentos más recientes de Cerebro.
- Devuelve:
  - `adn`: 2-3 oraciones sintetizando posicionamiento, audiencia y tono.
  - `hitosRecientes`: Array de 3 bullets con los focos/temas candentes de este mes.
  - `salud`: Total de documentos, fecha del último documento cargado, y flag de sincronización.
- Cache en memoria de 1 hora por cliente o invalidado al subir un nuevo documento.

### 3. Auditoría y Sincronización de Brand Kit (`POST /knowledge/audit-brand-kit` & `POST /knowledge/apply-brand-kit`)
- `POST /knowledge/audit-brand-kit`:
  - Cruza `BrandVoice.content` con los últimos 20 documentos/posts.
  - Claude detecta:
    - Ejes temáticos faltantes en `lineas_editoriales` o `mensajes_clave`.
    - Evolución de tono observada en publicaciones reales vs `identidad_verbal`.
    - Ajustes propuestos para los 11 campos oficiales.
  - Retorna `{ gaps: [...], proposedBrandVoice: { ... } }`.
- `POST /knowledge/apply-brand-kit`:
  - Aplica los cambios a `BrandVoice` del cliente.
  - Invalida la query `brand-voice` en frontend.

---

## Verification Plan

1. **Prueba Unitaria & Integración:**
   - Test de endpoint `upload-inferred` con simulación de subida.
   - Test de inferencia de metadata (fallback en caso de error).
   - Test de generación de `brand-pulse`.
   - Test de `audit-brand-kit` y persistencia en `BrandVoice`.
2. **Prueba End-to-End en Navegador:**
   - Arrastrar un archivo a `/knowledge-base` y ver aparecer el documento sin tipear nada.
   - Ver el bloque "Brand Pulse" arriba de la tabla.
   - Abrir el drawer de auditoría de Brand Kit, revisar desalineaciones y presionar "Aplicar".
3. **Suite Completa:**
   - `pnpm --filter web test` ejecutando los 29 archivos de test pasando 100%.
