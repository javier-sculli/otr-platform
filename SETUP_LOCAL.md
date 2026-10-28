# Guía de Setup Local — OTR Platform (para Shai)

> **Aclaración sobre Supabase:**  
> El proyecto **NO utiliza Supabase**. En septiembre de 2026 se migró toda la base de datos a PostgreSQL nativo en **Railway** y el sistema de autenticación es propio con Fastify (`apps/api`) usando JWT y Google OAuth o email/password. Por lo tanto, no se requieren credenciales ni proyectos de Supabase.

---

## ⚡ Prompt de Setup Automático (Copiar y pegar en Claude / Cursor / Asistente)

Si usás un asistente de código (Cursor, Claude Code, Windsurf, etc.), podés copiar y pegar este prompt completo para que configure todo de forma automática:

```markdown
Hola! Ayudame a configurar y levantar localmente el proyecto OTR Platform en mi máquina.

Nota de arquitectura: El proyecto NO usa Supabase; la base de datos es PostgreSQL alojada en Railway y la autenticación es propia con Fastify + JWT / Google OAuth.

Por favor, realizá los siguientes pasos:

1. Creá el archivo `apps/web/.env` con el siguiente contenido:
VITE_API_URL=http://localhost:3001

2. Creá el archivo `apps/api/.env` con el siguiente contenido:
# Railway Postgres Database (solicitar credenciales a Javi o usar local)
DATABASE_URL="postgresql://postgres:TU_PASSWORD@altaria.proxy.rlwy.net:23673/railway"
DIRECT_URL="postgresql://postgres:TU_PASSWORD@altaria.proxy.rlwy.net:23673/railway"

JWT_SECRET="dev-jwt-secret-change-in-production"
API_PORT=3001
NODE_ENV=development

# Google OAuth (pedir a Javi o usar login con email/password)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:5173

# APIs de IA (pedir a Javi las keys si vas a testear generación de contenido)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
APIFY_TOKEN=
RESEND_API_KEY=
RESEND_FROM="ROCKY Platform <notificaciones@ontherocks.tech>"

3. Instalá las dependencias del monorepo desde la raíz:
pnpm install

4. Generá el cliente de Prisma para el backend:
cd apps/api && pnpm prisma generate && cd ../..

5. Iniciá el entorno de desarrollo local (frontend y backend en paralelo):
pnpm dev

Una vez levantado:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Podés iniciar sesión con tu usuario habitual o registrarte desde la pantalla de login.
```

---

## 🛠️ Setup Manual Paso a Paso

Si preferís configurarlo manualmente:

### 1. Requisitos
- **Node.js** 18 o superior
- **pnpm** instalado globalmente:
  ```bash
  npm install -g pnpm
  ```

### 2. Configurar Variables de Entorno

#### Frontend (`apps/web/.env`)
Crear el archivo `apps/web/.env`:
```env
VITE_API_URL=http://localhost:3001
```

#### Backend (`apps/api/.env`)
Crear el archivo `apps/api/.env`:
```env
# Railway Postgres Database (solicitar credenciales o usar local)
DATABASE_URL="postgresql://postgres:TU_PASSWORD@altaria.proxy.rlwy.net:23673/railway"
DIRECT_URL="postgresql://postgres:TU_PASSWORD@altaria.proxy.rlwy.net:23673/railway"

JWT_SECRET="dev-jwt-secret-change-in-production"
API_PORT=3001
NODE_ENV=development

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:5173

# OpenAI / Anthropic / Resend (pedir keys a Javi si vas a probar generación de IA)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
APIFY_TOKEN=
RESEND_API_KEY=
RESEND_FROM="ROCKY Platform <notificaciones@ontherocks.tech>"
```

### 3. Instalación de dependencias y generación de Prisma

Desde la raíz del proyecto:
```bash
# Instalar todos los paquetes
pnpm install

# Generar cliente de Prisma
cd apps/api && pnpm prisma generate && cd ../..
```

### 4. Ejecutar el proyecto

Desde la raíz:
```bash
pnpm dev
```

Esto ejecuta en paralelo:
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **Frontend Web:** [http://localhost:5173](http://localhost:5173)

---

## 🔑 Autenticación / Login

1. Abrí [http://localhost:5173](http://localhost:5173).
2. Podés loguearte con tu usuario habitual, con Google OAuth si configuraste las keys, o registrándote directamente en `/login`.
