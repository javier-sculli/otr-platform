---
name: deployment_railway
description: Instrucciones para desplegar en Railway (web auto, API manual)
metadata:
  type: reference
---

## Deployment en Railway

**Web (frontend):** Se despliega automáticamente cuando haces push a `main` (webhook configurado)

**API (backend):** Requiere push manual via CLI de Railway

### Comandos para desplegar API

```bash
# Login una sola vez
railway login

# Deploy API
railway up --service api -m "descripcion del cambio"

# Con detach (no espera logs)
railway up --service api --detach -m "descripcion del cambio"
```

**Nota:** La CLI de Railway se instala con `npm install -g @railway/cli`

### Referencia
- Documentado en `/CLAUDE.md` → Sección "Deployment (Railway)"
