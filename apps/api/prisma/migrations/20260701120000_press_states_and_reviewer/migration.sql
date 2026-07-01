-- Unificar subestados de Prensa: sacar nombres propios de revisión y
-- fusionar Stand by + Pendiente en un solo estado (pedido de cliente).

-- 1. Cambiar columna a TEXT para poder operar libremente
ALTER TABLE tickets ALTER COLUMN sub_estado TYPE TEXT;

-- 2. Eliminar el enum viejo
DROP TYPE "SubEstado";

-- 3. Crear el enum nuevo
CREATE TYPE "SubEstado" AS ENUM (
  'PENDIENTE',
  'EN_CURSO',
  'REVISION_INTERNA',
  'ENVIADO_CLIENTE',
  'A_PUBLICAR',
  'LISTO',
  'CANCELADO'
);

-- 4. Migrar datos existentes
UPDATE tickets SET sub_estado = 'PENDIENTE'         WHERE sub_estado = 'STAND_BY';
UPDATE tickets SET sub_estado = 'REVISION_INTERNA'  WHERE sub_estado IN ('REV_SANTI', 'REV_MANU');

-- 5. Restaurar columna al nuevo enum
ALTER TABLE tickets ALTER COLUMN sub_estado TYPE "SubEstado" USING sub_estado::"SubEstado";

-- 6. Campo de asignación para "En revisión interna"
ALTER TABLE tickets ADD COLUMN reviewer_id TEXT;
ALTER TABLE tickets ADD CONSTRAINT tickets_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX tickets_reviewer_id_idx ON tickets(reviewer_id);
