# LinkedIn Metrics — Scraping con Apify

**Fecha:** 2026-03-31
**Archivos creados/modificados:**
- `apps/api/prisma/schema.prisma` — modelos `Publication` (extendido) + `PostMetricSnapshot` (nuevo)
- `apps/api/prisma/migrations/20260331193716_add_publication_snapshots/`
- `apps/api/src/jobs/syncLinkedInMetrics.ts` — lógica de scraping
- `apps/api/src/jobs/cron.ts` — cron diario 8am ARG
- `apps/api/src/routes/metrics.ts` — endpoints REST
- `apps/api/src/server.ts` — registro de ruta `/metrics` y cron
- `apps/api/src/routes/tickets.ts` — eliminado campo `metrics` (Json) del upsert de Publication

## Decisiones de diseño

### Scraper elegido: harvestapi/linkedin-profile-posts
- Actor ID: `A3cAPGpwBEG8RJwse` (harvestapi/linkedin-profile-posts)
- Sin login requerido, ~$2/1k posts, 5.7M+ runs, 99.8% success rate
- Scrapa por URL de cuenta (company o profile), no por post individual
- **Impresiones NO disponibles** — LinkedIn no las expone públicamente. Solo se pueden obtener via LinkedIn Marketing API (requiere partnership) o herramientas como Metricool con OAuth de page admin
- Input clave: `targetUrls` (array de URLs de cuentas), `maxPosts`, `postedLimit`
- Output: `linkedinUrl`, `content`, `postedAt`, `postImages`, `engagement.likes/comments/shares`

### Flujo de scraping por cuenta (no por post)
- La URL de LinkedIn se guarda en `Client.linkedinUrl`
- El cron itera clientes activos con `linkedinUrl` configurado
- Por cada cliente: llama al actor con la URL de la cuenta, obtiene últimos 50 posts del último mes
- Por cada post: upsert `Publication` por `url` (evita duplicados), luego upsert snapshot

### Schema: extender Publication, no crear nuevo modelo
- `Publication` ya existía (1:1 con Ticket), tenía `url`, `publishedAt`, `metrics` (Json)
- Se eliminó el campo Json `metrics` y se reemplazó por relación con `PostMetricSnapshot`
- Se agregaron `canal`, `imageUrl`, `postContent`, `isHighlight`, `tags` a `Publication`
- `ticketId` pasó a ser **opcional** — publications pueden existir sin ticket (scrapeadas automáticamente)
- `clientId` es **requerido** — toda publication siempre pertenece a un cliente
- `url` tiene `@unique` — garantiza no duplicar posts
- Migración incluye backfill de `clientId` desde el ticket relacionado para datos existentes

### Lógica de snapshots (máximo 6 rows por post)
- `dayNumber` 1–5: snapshots diarios. Si ya existe el del día, se saltea (no se pisa)
- `dayNumber` 99: foto final. Se upserta siempre (pisa el anterior)
- `@@unique([publicationId, dayNumber])` garantiza el límite y permite upsert limpio

### Cron
- Corre a las 11:00 UTC = 8:00 AM ARG
- Se registra al levantar el servidor (en `server.ts`, después del `listen`)
- Dependencia: `node-cron` + `apify-client`

### Endpoints `/metrics`
- `GET /metrics?clientId=xxx` — lista publications con snapshots
- `GET /metrics/:publicationId` — detalle con snapshots
- `PATCH /metrics/:publicationId` — editar isHighlight, tags, insights, url, canal
- `POST /metrics/:publicationId/snapshots` — agregar snapshot manual
- `POST /metrics/sync` — trigger manual del scraper (async, no bloquea)

## Variable de entorno requerida
```
APIFY_TOKEN=apify_api_xxxx
```
Obtener en: https://console.apify.com/account/integrations

## Cómo activar para un cliente
1. Agregar `APIFY_TOKEN` al `.env` de la API
2. Setear `linkedinUrl` en el registro del cliente (ej: `https://linkedin.com/company/nombre-empresa`)
3. El cron corre automáticamente a las 8am ARG, o trigger manual via `POST /metrics/sync` con `{ clientId }`

## Estado
- Backend completamente implementado y typechecking sin errores
- **Pendiente**: conectar frontend (PublicationPerformance.tsx)
- **Pendiente**: agregar `APIFY_TOKEN` al .env
- **Pendiente**: exponer campo `linkedinUrl` en la UI de Clientes para que se pueda cargar desde la interfaz
