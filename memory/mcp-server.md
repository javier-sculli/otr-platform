---
name: mcp-server
description: Servidor MCP remoto (apps/mcp) para conectar Claude Desktop/Slack a OTR — arquitectura OAuth y decisiones
metadata:
  type: reference
---

## Qué es

`apps/mcp` — servidor MCP remoto que expone tools (`list_tickets`, `get_ticket`, `create_ticket`, `update_ticket`, `list_clients`, `get_client_stats`, `list_catalogs`) para conectar Claude Desktop y Claude en Slack a la plataforma OTR. Verificado end-to-end en local con `@modelcontextprotocol/inspector` (login real de Google + listado de tickets/clientes funcionando).

## Decisiones de arquitectura

- **El MCP no toca Prisma/DB directamente.** Cada tool le pega por HTTP a `apps/api` reenviando el bearer token — una sola fuente de verdad para lógica de negocio.
- **Reusa el login de Google que ya existe**, no lo reimplementa: `apps/api/src/lib/google-oauth.ts` expone `resolveGoogleUser()`, compartido entre el callback de la SPA (`GET /auth/google/callback`) y el nuevo `POST /auth/google/exchange` (JSON, usado por el MCP).
- **El access token de MCP es el JWT de `apps/api` tal cual** (mismo `JWT_SECRET`) — el MCP verifica con `jwt.verify`, sin llamar a la API en cada request.
- **DCR (Dynamic Client Registration) en memoria**, no persiste entre reinicios de Railway — si el proceso reinicia con un cliente ya registrado, Claude vuelve a registrarse solo. Aceptable para el volumen de uso interno.

## Gotchas encontrados en la implementación (2026-07-01)

- **zod v3.25+ con `registerTool` del SDK cuelga `tsc` (OOM)** si se importa `from 'zod'`. Fix: importar `from 'zod/v4'` (subpath que trae zod 3.25+, mismo que usan los ejemplos oficiales del SDK). Ver [tools/tickets.ts](../apps/mcp/src/tools/tickets.ts) y [tools/catalogs.ts](../apps/mcp/src/tools/catalogs.ts).
- **CORS**: `mcpAuthRouter` (well-knowns, `/register`, `/authorize`, `/token`) trae su propio CORS. La ruta `/mcp` que arma uno mismo con Express **no** — hay que agregar `cors()` manualmente ahí, con `exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id']` (si no, el navegador no puede leer `WWW-Authenticate` para el discovery OAuth).
- **Los JWT de `apps/api` no tienen `exp`** (el login web nunca expira). El SDK de MCP exige que los access tokens expiren (`requireBearerAuth` rechaza con "Token has no expiration time" si no). Fix: `resolveGoogleUser()` acepta `options.expiresIn`; `/auth/google/exchange` pasa `'90d'`, el callback de la SPA no pasa nada (sigue sin expirar, comportamiento intacto).
- **URL del Inspector**: el Transport Type "Streamable HTTP" apunta a `http://localhost:3002/mcp` — el campo URL por default trae `/sse` de un preset viejo, hay que pisarlo a mano.

## Deploy en Railway (2026-07-01)

- Servicio `mcp` creado en el proyecto `otr-platform` (mismo que `api`), deploy con `railway up ./apps/mcp --path-as-root --service mcp` (root directory pasado por CLI, no configurado en el dashboard).
- Dominio público: `https://mcp-production-93bc.up.railway.app` — health check y metadata OAuth verificados en producción.
- Env vars copiadas de `api`: `JWT_SECRET`, `GOOGLE_CLIENT_ID`. Propias: `API_BASE_URL=https://api-production-f8e7.up.railway.app`, `MCP_PUBLIC_URL=https://mcp-production-93bc.up.railway.app`, `NODE_ENV=production`.

## Pendiente (fuera de código)

- **Agregar `https://mcp-production-93bc.up.railway.app/oauth/google/callback` a los Authorized redirect URIs del cliente OAuth de Google Cloud** (el de local ya está agregado) — sin esto el login en prod falla con `redirect_uri_mismatch`.
- Dar de alta el Custom Connector en Claude Desktop apuntando a `https://mcp-production-93bc.up.railway.app/mcp`, y si aplica, en Slack (Team/Enterprise).

Ver también [deployment_railway.md](deployment_railway.md) para el flujo general de deploy manual del API (mismo patrón para el servicio `mcp`).
