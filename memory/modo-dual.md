# Modo dual de modelos

**Fecha:** Antes de 2026-03-31
**Archivos afectados:** `WorkspacePieza.tsx` y settings relacionados

## Qué se implementó

- Claude Sonnet como modelo por defecto
- GPT-4o como segundo modelo en modo dual
- Ambos modelos responden en paralelo con el mismo Brand Kit como contexto

## Decisiones

- El modo dual es para fase de prueba/calibración, no necesariamente permanente
- Scope futuro: simplificar a botón "regenerar con otro modelo" si el dual no agrega valor en uso real
- Por defecto arranca con los 2 modelos activos

## Estado
- Commiteado (commit `6cde81f`)
