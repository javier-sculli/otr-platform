-- Migrar estados de tickets: convertir columna a TEXT, recrear enum, migrar datos, restaurar tipo

-- 1. Soltar el default antes de cambiar el tipo
ALTER TABLE tickets ALTER COLUMN status DROP DEFAULT;

-- 2. Cambiar columna a TEXT para poder operar libremente
ALTER TABLE tickets ALTER COLUMN status TYPE TEXT;

-- 3. Eliminar el enum viejo
DROP TYPE "TicketStatus";

-- 4. Crear el enum nuevo
CREATE TYPE "TicketStatus" AS ENUM (
  'PENDIENTE',
  'REDACCION',
  'DISENO',
  'EDICION',
  'REVISION_INTERNA',
  'CLIENTE',
  'ESPERANDO_FEEDBACK',
  'LISTO_PARA_PUBLICAR',
  'PUBLICADO',
  'CANCELADO',
  'LISTO'
);

-- 5. Migrar datos existentes
UPDATE tickets SET status = 'PENDIENTE'          WHERE status = 'BACKLOG';
UPDATE tickets SET status = 'REDACCION'          WHERE status IN ('BRIEF', 'CONTENIDO');
UPDATE tickets SET status = 'REVISION_INTERNA'   WHERE status = 'REVISION';
UPDATE tickets SET status = 'LISTO_PARA_PUBLICAR' WHERE status = 'APROBADO';
-- DISENO y CANCELADO se mantienen igual

-- 6. Restaurar columna al nuevo enum
ALTER TABLE tickets ALTER COLUMN status TYPE "TicketStatus" USING status::"TicketStatus";

-- 7. Restaurar default
ALTER TABLE tickets ALTER COLUMN status SET DEFAULT 'PENDIENTE';
