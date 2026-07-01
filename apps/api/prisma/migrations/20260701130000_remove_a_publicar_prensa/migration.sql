-- Eliminar el subestado "A publicar" de Prensa: el cliente no lo pidió,
-- se fusiona en "Completado" (LISTO).

ALTER TABLE tickets ALTER COLUMN sub_estado TYPE TEXT;

DROP TYPE "SubEstado";

CREATE TYPE "SubEstado" AS ENUM (
  'PENDIENTE',
  'EN_CURSO',
  'REVISION_INTERNA',
  'ENVIADO_CLIENTE',
  'LISTO',
  'CANCELADO'
);

UPDATE tickets SET sub_estado = 'LISTO' WHERE sub_estado = 'A_PUBLICAR';

ALTER TABLE tickets ALTER COLUMN sub_estado TYPE "SubEstado" USING sub_estado::"SubEstado";
