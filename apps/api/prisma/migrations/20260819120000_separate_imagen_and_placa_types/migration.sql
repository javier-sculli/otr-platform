-- Ensure 'Imagen', 'Placa Gráfica', and 'Texto' exist as CONTENIDO ticket types
INSERT INTO "ticket_types" ("id", "name", "kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Imagen', 'CONTENIDO', now(), now()),
  (gen_random_uuid(), 'Placa Gráfica', 'CONTENIDO', now(), now()),
  (gen_random_uuid(), 'Texto', 'CONTENIDO', now(), now())
ON CONFLICT ("name", "kind") DO NOTHING;

-- Migrate tickets pointing to legacy graphic plate names to 'Placa Gráfica'
UPDATE "tickets"
SET "ticket_type_id" = (SELECT "id" FROM "ticket_types" WHERE "name" = 'Placa Gráfica' AND "kind" = 'CONTENIDO' LIMIT 1)
WHERE "ticket_type_id" IN (
  SELECT "id" FROM "ticket_types"
  WHERE "kind" = 'CONTENIDO'
  AND (
    LOWER("name") = 'placa con diseño'
    OR LOWER("name") = 'placa con diseno'
    OR LOWER("name") = 'placa'
    OR LOWER("name") = 'imagen gráfica'
    OR LOWER("name") = 'imagen grafica'
    OR LOWER("name") = 'gráfica'
    OR LOWER("name") = 'grafica'
  )
  AND "name" != 'Placa Gráfica'
);

-- Delete legacy graphic plate ticket types
DELETE FROM "ticket_types"
WHERE "kind" = 'CONTENIDO'
AND (
  LOWER("name") = 'placa con diseño'
  OR LOWER("name") = 'placa con diseno'
  OR LOWER("name") = 'placa'
  OR LOWER("name") = 'imagen gráfica'
  OR LOWER("name") = 'imagen grafica'
  OR LOWER("name") = 'gráfica'
  OR LOWER("name") = 'grafica'
)
AND "name" != 'Placa Gráfica';

-- Migrate tickets pointing to legacy image names to 'Imagen'
UPDATE "tickets"
SET "ticket_type_id" = (SELECT "id" FROM "ticket_types" WHERE "name" = 'Imagen' AND "kind" = 'CONTENIDO' LIMIT 1)
WHERE "ticket_type_id" IN (
  SELECT "id" FROM "ticket_types"
  WHERE "kind" = 'CONTENIDO'
  AND (
    LOWER("name") = 'imagen sola'
    OR LOWER("name") = 'imagen estática'
    OR LOWER("name") = 'imagen estatica'
  )
  AND "name" != 'Imagen'
);

-- Delete legacy image ticket types
DELETE FROM "ticket_types"
WHERE "kind" = 'CONTENIDO'
AND (
  LOWER("name") = 'imagen sola'
  OR LOWER("name") = 'imagen estática'
  OR LOWER("name") = 'imagen estatica'
)
AND "name" != 'Imagen';

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
