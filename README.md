# OTR Platform

Plataforma operativa interna para gestión de tickets y contenido.

## 🏗️ Arquitectura

Monorepo TypeScript con:
- **Backend**: Fastify + Prisma + PostgreSQL (Railway)
- **Frontend**: React + Vite + TailwindCSS + TanStack Query
- **Packages**: Tipos y schemas compartidos

## 📁 Estructura del proyecto

```
otr-platform/
├── apps/
│   ├── api/          # Backend (Fastify)
│   └── web/          # Frontend (React)
├── packages/
│   ├── types/        # Tipos TypeScript compartidos
│   └── schemas/      # Validación Zod compartida
└── package.json      # Workspace root
```

## 🚀 Setup inicial

### 1. Instalar dependencias

Requerimientos:
- Node.js 18+
- pnpm 8+

```bash
# Instalar pnpm si no lo tenés
npm install -g pnpm

# Instalar dependencias del proyecto
pnpm install
```

### 2. Configurar base de datos

La base de datos oficial del proyecto es un PostgreSQL alojado en **Railway** (**NO se usa Supabase**).

- **Opción recomendada (desarrollo):** Conectarse directamente a la base de datos de Railway configurando la `DATABASE_URL` provista en `apps/api/.env`.
- **Opción local aislada (Docker):** Si preferís correr una base de datos propia:
  ```bash
  docker run --name otr-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=otr_platform -p 5432:5432 -d postgres:14
  ```

### 3. Configurar variables de entorno

Copiar los archivos de ejemplo:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Configurar `DATABASE_URL` y `JWT_SECRET` en `apps/api/.env`.

### 4. Generar Prisma y migraciones
```bash
cd apps/api
pnpm prisma generate
# (Solo si usás una base de datos local propia vacía):
# pnpm prisma migrate dev
# pnpm prisma:seed
cd ../..
```

### 5. Prisma Studio (opcional)

Para explorar los datos existentes de la base de datos de Railway o local:

```bash
cd apps/api
pnpm prisma:studio
```

## 🛠️ Desarrollo

### Iniciar todo el proyecto

```bash
# Desde el root, inicia frontend y backend en paralelo
pnpm dev
```

Esto corre:
- Backend en http://localhost:3001
- Frontend en http://localhost:5173

### Iniciar backend solo

```bash
pnpm api
```

### Iniciar frontend solo

```bash
pnpm web
```

### Otros comandos útiles

```bash
# Typecheck en todo el proyecto
pnpm typecheck

# Build de producción
pnpm build

# Prisma Studio (explorar DB)
cd apps/api && pnpm prisma:studio
```

## 🗄️ Modelo de datos

### Entidades principales

- **User**: Usuarios del sistema (contenidistas, coordinadores, dirección)
- **Client**: Clientes de la agencia
- **Area**: Áreas de trabajo (contenido, diseño, estrategia)
- **TicketType**: Tipos de tickets (post RRSS, artículo, video, etc.)
- **Ticket**: Unidad core del sistema
- **Publication**: Publicación asociada a un ticket (opcional)

### Estados de ticket

- `BACKLOG`: Sin empezar
- `EN_PROGRESO`: En proceso
- `REVISION`: En revisión
- `BLOQUEADO`: Bloqueado
- `CERRADO`: Cerrado

### Motivos de cierre

- `PUBLICADO`: Se publicó
- `ENTREGADO`: Se entregó internamente
- `CANCELADO`: Se canceló

## 🔌 API Endpoints

### Auth

- `POST /auth/login` - Login con email/password
- `GET /auth/me` - Obtener usuario actual
- `POST /auth/logout` - Logout

### Tickets

- `GET /tickets` - Listar tickets (con filtros query params)
- `GET /tickets/:id` - Detalle de ticket
- `POST /tickets` - Crear ticket
- `PATCH /tickets/:id` - Actualizar ticket
- `DELETE /tickets/:id` - Eliminar ticket
- `POST /tickets/:id/publication` - Crear/actualizar publicación
- `GET /tickets/:id/publication` - Obtener publicación

### Catálogos

- `GET /catalogs/clients` - Listar clientes
- `GET /catalogs/users` - Listar usuarios
- `GET /catalogs/areas` - Listar áreas
- `GET /catalogs/ticket-types` - Listar tipos de tickets

Todos los endpoints (excepto `/auth/login`) requieren token JWT en header:
```
Authorization: Bearer <token>
```

## 🚢 Deploy

### Opción recomendada: Vercel + Render (gratis)

#### Frontend (Vercel)

1. Conectar repo a Vercel
2. Configurar:
   - Framework: Vite
   - Root directory: `apps/web`
   - Build command: `pnpm build`
   - Output directory: `dist`
3. Variables de entorno:
   - `VITE_API_URL`: URL de tu backend

#### Backend + DB (Render)

1. Crear PostgreSQL database en Render (gratis)
2. Crear Web Service:
   - Root directory: `apps/api`
   - Build command: `pnpm install && pnpm prisma generate && pnpm build`
   - Start command: `pnpm prisma migrate deploy && node dist/server.js`
3. Variables de entorno:
   - `DATABASE_URL`: (copiar de Render PostgreSQL)
   - `JWT_SECRET`: (generar con openssl)
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: URL de Vercel

### Arquitectura de Producción

- **Railway**: Backend (`apps/api`), Frontend (`apps/web`) y PostgreSQL alojados en Railway.
- **Vercel**: Opción alternativa para frontend (`apps/web`).

## 📝 Próximos pasos (fuera del MVP)

### NO implementar todavía:

- ❌ Real-time / WebSockets
- ❌ Roles y permisos granulares
- ❌ Búsqueda avanzada / full-text
- ❌ Integraciones externas (Meta, GA, etc.)
- ❌ Notificaciones (email, push)
- ❌ Audit log / historial de cambios
- ❌ Attachments / uploads de archivos
- ❌ Calendario general
- ❌ CMS de contenido
- ❌ Chat / comentarios

### Posibles mejoras post-MVP:

1. **Crear tickets**: Agregar formulario para crear desde el frontend
2. **Editar tickets**: Formulario de edición inline
3. **Búsqueda simple**: Client-side filter en la tabla
4. **Paginación**: Si hay >100 tickets
5. **Validación**: Agregar validación Zod en frontend
6. **Loading states**: Mejorar feedback visual
7. **Error handling**: Toast notifications para errores
8. **Tests**: Unit tests + E2E tests

## 🐛 Troubleshooting

### Error: "Database connection failed"

Verificar:
- PostgreSQL está corriendo
- `DATABASE_URL` en `.env` es correcta
- Usuario tiene permisos en la DB

### Error: "JWT malformed"

- Asegurarse de que `JWT_SECRET` esté configurado
- Verificar que el token se esté pasando correctamente

### Frontend no conecta con backend

- Verificar `VITE_API_URL` en `apps/web/.env`
- Verificar CORS en backend (`config.frontendUrl`)

## 📚 Stack técnico

### Backend
- **Fastify** 4.x - Web framework
- **Prisma** 5.x - ORM
- **@fastify/jwt** - Auth JWT
- **@fastify/cors** - CORS
- **bcrypt** - Password hashing
- **Zod** - Validación de schemas

### Frontend
- **React** 18.x - UI library
- **Vite** 5.x - Build tool
- **TanStack Query** 5.x - Data fetching
- **React Router** 6.x - Routing
- **TailwindCSS** 3.x - Styling
- **Zod** - Validación de schemas

### Database
- **PostgreSQL** 14+ - Base de datos relacional

## 🤝 Contribuir

Por ahora es un MVP interno. Si querés agregar features, verificar que estén alineados con el scope del MVP.

## 📄 Licencia

MIT
