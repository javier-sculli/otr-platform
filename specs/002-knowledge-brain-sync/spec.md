# Feature Specification: Zero-Form Upload, Brand Pulse Dashboard, and Brand Kit Audit & Sync

**Feature Branch**: `002-knowledge-brain-sync`  
**Created**: 2026-10-30  
**Status**: Ready for Planning & Implementation  
**Input**: Requerimientos estratégicos de Javier Sculli para transformar Cerebro en el núcleo vivo de inteligencia de marca de OTR.

---

## Business Goal & Problem Statement
Actualmente, el Brand Kit de cada cliente en Rocky (`BrandVoice`) es un conjunto estático de 11 campos de texto que los redactores raramente actualizan y que el nuevo chat de Cerebro no cruza de forma bidireccional. Además, para incorporar documentos de diseño, presentaciones o notas de marca a Cerebro, se requería clasificar manualmente los datos.

Este feature transforma la experiencia en tres pilares:
1. **Ingesta Zero-Form**: Arrastrar y soltar archivos (PDFs de Brandbooks, decks de diseño, transcripciones o notas) sin completar formularios; la IA infiere título, tipo, relevancia estratégica, resumen y tags.
2. **Brand Pulse (Resumen Ejecutivo)**: Al entrar a `/knowledge-base`, un encabezado vivo presenta el ADN de la marca, los focos/hitos del mes y la salud del conocimiento.
3. **Audit & Sync del Brand Kit**: Un botón que audita el Brand Kit contra toda la data viva de Cerebro, detecta desalineaciones o nuevos ejes temáticos, y permite actualizar el Brand Kit con 1 solo click.

---

## User Scenarios & Testing *(Prioritized User Stories)*

### User Story 1 - Ingesta "Zero-Form" con Inferencia Total por IA (Priority: P1)
**User Journey**: Un redactor o account manager tiene un PDF del Brandbook de un cliente, un deck de ventas o una transcripción de Google Meet. Abre Cerebro, arrastra el archivo o pega el texto en la zona de drop, y el sistema extrae el contenido, ejecuta un análisis inteligente y le presenta una tarjeta lista con:
- Título ejecutivo limpio
- Tipo detectado (`BRAND_GUIDELINES`, `DESIGN_SYSTEM`, `DECK`, `REUNION`, `FEEDBACK`, `DOCUMENTO`)
- Relevancia estratégica (`ALTA / ESTRATÉGICO`, `MEDIA / TÁCTICO`, `OPERATIVO`)
- Resumen en 3 bullets
- Tags sugeridos

El usuario puede confirmar con 1 click o el sistema lo guarda automáticamente.

**Why this priority**: Elimina la fricción número 1 que impide que el equipo cargue material base de marca y diseño.

**Acceptance Scenarios**:
1. **Given** un usuario en `/knowledge-base` de un cliente, **When** arrastra un archivo de texto/PDF o pega texto sin llenar ningún campo y presiona "Subir", **Then** la IA analiza el contenido, infiere título, tipo, relevancia, tags y resumen, y lo guarda en `knowledge_documents`.
2. **Given** un archivo subido sin título manual, **When** se guarda, **Then** el documento aparece inmediatamente en la lista de documentos y pasa a ser consultable por el chat y el redactor de tickets.

---

### User Story 2 - Tablero "Brand Pulse" (Resumen Ejecutivo al tope de Cerebro) (Priority: P2)
**User Journey**: Al ingresar a la vista de Cerebro de un cliente (ej. Cámara Fintech), el usuario no ve únicamente una tabla o un chat vacío. En la parte superior encuentra una tarjeta destacada "Brand Pulse" que sintetiza:
- **ADN & Posicionamiento (3 líneas)**: A quién le hablan, su propuesta de valor y tono dominante.
- **Hitos & Focos del Mes (3 bullets)**: Los temas clave más recientes discutidos o publicados.
- **Métricas de Salud del Conocimiento**: Total de documentos, fecha de última actualización y estado de sincronización con el Brand Kit.

**Why this priority**: Da visibilidad inmediata a los redactores de en qué estado está la marca antes de escribir una sola línea.

**Acceptance Scenarios**:
1. **Given** un cliente con documentos cargados, **When** se accede a `/knowledge-base`, **Then** se renderiza el bloque `Brand Pulse` con la síntesis del contexto y los hitos recientes.
2. **Given** un cliente nuevo sin documentos, **When** se accede a `/knowledge-base`, **Then** el bloque muestra un estado vacío invitando a subir el primer documento de marca.

---

### User Story 3 - Auditoría y Sincronización Automática de Brand Kit ("Audit & Sync") (Priority: P3)
**User Journey**: El director de cuenta quiere verificar si el Brand Kit de un cliente refleja la realidad de las publicaciones y minutas de los últimos meses. Hace click en **"Auditar Brand Kit"**:
1. El backend compara los 11 campos de `BrandVoice` con los últimos documentos y publicaciones.
2. Devuelve un diagnóstico visual:
   - *Ejes temáticos emergentes no contemplados* (ej: IA en finanzas, finanzas abiertas).
   - *Desviaciones de tono o formato* (ej: posts en primera persona con mayor engagement).
   - *Propuesta concreta de actualización para cada campo*.
3. El usuario revisa las sugerencias y hace click en **"Aplicar al Brand Kit"**, actualizando `BrandVoice` en PostgreSQL instantáneamente.

**Why this priority**: Conecta el Cerebro directamente con la herramienta de redacción de tickets, cerrando el ciclo de retroalimentación viva.

**Acceptance Scenarios**:
1. **Given** un cliente con Brand Kit desactualizado, **When** se dispara `POST /knowledge/audit-brand-kit`, **Then** se devuelve un análisis de brechas estructurado con sugerencias campo por campo.
2. **Given** el reporte de sugerencias aprobado, **When** se confirma `POST /knowledge/apply-brand-kit-sync`, **Then** la tabla `brand_voices` se actualiza y los tickets nuevos se redactan con ese nuevo contexto.

---

## Requirements Checklist & Edge Cases
- [ ] Soporte para subir archivos `.pdf`, `.txt`, `.md`, `.doc/.docx` y texto crudo.
- [ ] Extracción de texto en backend sin bloquear solicitudes (fast parsing).
- [ ] Fallback en caso de timeout del LLM para que el documento no se pierda.
- [ ] Permisos: Solo usuarios autenticados pueden auditar o modificar el Brand Kit.
- [ ] Backward compatibility: No romper los endpoints existentes ni la estructura de `BrandVoice.content`.
