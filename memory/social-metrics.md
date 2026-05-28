# Social Metrics — Scraping con Apify (LinkedIn + Instagram + Twitter)

**Fecha:** 2026-05-28  
**Archivos creados/modificados:**
- `apps/api/src/jobs/syncLinkedInMetrics.ts` — scraping LinkedIn (existía)
- `apps/api/src/jobs/syncInstagramMetrics.ts` — scraping Instagram (nuevo)
- `apps/api/src/jobs/syncTwitterMetrics.ts` — scraping Twitter/X (nuevo)
- `apps/api/src/jobs/cron.ts` — corre los 3 syncs diario a 8am ARG
- `apps/api/src/routes/metrics.ts` — endpoint `/sync` acepta param `network`
- `apps/web/src/pages/PerformancePage.tsx` — botón sync multi-red con dropdown
- `apps/web/src/lib/api.ts` — `syncMetrics(network, clientId?)`

## Actores Apify usados

| Red | Actor ID | Input clave |
|-----|----------|-------------|
| LinkedIn | `A3cAPGpwBEG8RJwse` (harvestapi/linkedin-profile-posts) | `targetUrls`, `maxPosts`, `postedLimit` |
| Instagram | `apify/instagram-post-scraper` | `directUrls`, `resultsType: 'posts'`, `resultsLimit` |
| Twitter | `apify/twitter-scraper` | `startUrls`, `maxTweets`, `mode: 'UserTweets'` |

## Migración DB — campos extra en PostMetricSnapshot
- `views Int?` — impresiones (Twitter/X)
- `bookmarks Int?` — guardados (Twitter/X)  
- `quotes Int?` — quote tweets (Twitter/X)
- Todos opcionales (null para LinkedIn/Instagram)
- Migración: `20260528152412_add_twitter_metrics`

## Campos de salida por red

### Instagram (ApifyInstagramPost)
- `shortCode` → URL: `https://www.instagram.com/p/{shortCode}/`
- `url` — URL directa (si disponible)
- `caption` → `postContent`
- `likesCount`, `commentsCount` (no hay shares en Instagram → se guarda 0)
- `timestamp` → `publishedAt`
- `displayUrl` → `imageUrl`

### Twitter (ApifyTweet)
- `id_str` o `id` → URL: `https://twitter.com/{handle}/status/{id}`
- `url` — URL directa (si disponible)
- `text` o `full_text` → `postContent`
- `likeCount` / `favorite_count` → likes
- `replyCount` / `reply_count` → comments
- `retweetCount` / `retweet_count` → shares
- `createdAt` / `created_at` → `publishedAt`
- Maneja ambas formas de campo (v1 y v2 del actor)

## Username/handle extraction
- Instagram: regex `instagram\.com\/([^/?#]+)` sobre `instagramUrl`
- Twitter: regex `(?:twitter|x)\.com\/([^/?#]+)` sobre `twitterUrl`

## Endpoint `/metrics/sync`
```
POST /metrics/sync
Body: { network?: 'linkedin' | 'instagram' | 'twitter' | 'all'; clientId?: string }
```
- `network` defecto: `'all'` (corre los 3 syncs)
- El sync corre async (no bloquea la respuesta)

## Frontend — PerformancePage
- Botón split: botón principal (sincroniza la red seleccionada) + chevron (abre dropdown)
- Dropdown muestra: Todas las redes / LinkedIn / Instagram / Twitter
- Al seleccionar una opción del dropdown, sincroniza inmediatamente esa red
- El estado `syncNetwork` persiste la última red seleccionada
- Close-on-outside-click via `useEffect` + `ref`

## Variables de entorno requeridas
```
APIFY_TOKEN=apify_api_xxxx
```

## Cómo activar para un cliente
1. Setear `instagramUrl` y/o `twitterUrl` en el registro del cliente
2. Idem para los voceros del cliente (`Speaker.instagramUrl`, `Speaker.twitterUrl`)
3. El cron corre automáticamente a las 8am ARG, o trigger manual via el botón en PerformancePage

## Estado
- Backend completamente implementado, typecheck sin errores
- Frontend: botón sync actualizado, filtros por red ya existían
- **Pendiente**: conectar el frontend de performance al API (PublicationPerformance.tsx → PerformancePage.tsx ya tiene la integración completa)
- **Pendiente**: exponer campos `instagramUrl` / `twitterUrl` en UI de Clientes y Voceros para cargar desde la interfaz
- **Pendiente**: agregar `APIFY_TOKEN` al .env del servidor
