-- Ensure 'Imagen Gráfica' and 'Texto' exist as CONTENIDO ticket types
INSERT INTO "ticket_types" ("id", "name", "kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Imagen Gráfica', 'CONTENIDO', now(), now()),
  (gen_random_uuid(), 'Texto', 'CONTENIDO', now(), now())
ON CONFLICT ("name", "kind") DO NOTHING;

-- Migrate tickets pointing to 'Imagen', 'Placa con diseño' or legacy combined types to 'Imagen Gráfica'
UPDATE "tickets"
SET "ticket_type_id" = (SELECT "id" FROM "ticket_types" WHERE "name" = 'Imagen Gráfica' AND "kind" = 'CONTENIDO' LIMIT 1)
WHERE "ticket_type_id" IN (
  SELECT "id" FROM "ticket_types"
  WHERE "kind" = 'CONTENIDO'
  AND (
    LOWER("name") = 'imagen'
    OR LOWER("name") = 'imagen sola'
    OR LOWER("name") = 'imagen estática'
    OR LOWER("name") = 'imagen estatica'
    OR LOWER("name") = 'placa con diseño'
    OR LOWER("name") = 'placa con diseno'
    OR LOWER("name") = 'placa'
    OR LOWER("name") = 'gráfica'
    OR LOWER("name") = 'grafica'
    OR (LOWER("name") LIKE '%imagen%' AND (LOWER("name") LIKE '%grafica%' OR LOWER("name") LIKE '%gráfica%'))
    OR LOWER("name") LIKE '%imagen /%'
    OR LOWER("name") LIKE '%imagen (%'
  )
  AND "name" != 'Imagen Gráfica'
);

-- Delete legacy 'Imagen', 'Placa con diseño' or combined ticket types
DELETE FROM "ticket_types"
WHERE "kind" = 'CONTENIDO'
AND (
  LOWER("name") = 'imagen'
  OR LOWER("name") = 'imagen sola'
  OR LOWER("name") = 'imagen estática'
  OR LOWER("name") = 'imagen estatica'
  OR LOWER("name") = 'placa con diseño'
  OR LOWER("name") = 'placa con diseno'
  OR LOWER("name") = 'placa'
  OR LOWER("name") = 'gráfica'
  OR LOWER("name") = 'grafica'
  OR (LOWER("name") LIKE '%imagen%' AND (LOWER("name") LIKE '%grafica%' OR LOWER("name") LIKE '%gráfica%'))
  OR LOWER("name") LIKE '%imagen /%'
  OR LOWER("name") LIKE '%imagen (%'
)
AND "name" != 'Imagen Gráfica';

-- Migrate tickets pointing to 'Texto solo' to 'Texto'
UPDATE "tickets"
SET "ticket_type_id" = (SELECT "id" FROM "ticket_types" WHERE "name" = 'Texto' AND "kind" = 'CONTENIDO' LIMIT 1)
WHERE "ticket_type_id" IN (
  SELECT "id" FROM "ticket_types"
  WHERE "kind" = 'CONTENIDO'
  AND (
    LOWER("name") = 'texto solo'
    OR LOWER("name") = 'texto-solo'
  )
  AND "name" != 'Texto'
);

-- Delete legacy 'Texto solo' ticket types
DELETE FROM "ticket_types"
WHERE "kind" = 'CONTENIDO'
AND (
  LOWER("name") = 'texto solo'
  OR LOWER("name") = 'texto-solo'
)
AND "name" != 'Texto';
