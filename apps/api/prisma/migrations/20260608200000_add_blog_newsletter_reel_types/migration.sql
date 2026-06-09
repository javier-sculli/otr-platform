-- Add missing CONTENIDO ticket types (blog, newsletter, reel) — idempotent.
-- Un blogpost/newsletter/reel es Contenido (Pieza), no Tarea, y debe poder redactarse con IA.
INSERT INTO "ticket_types" ("id", "name", "kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Blog',       'CONTENIDO', now(), now()),
  (gen_random_uuid(), 'Newsletter', 'CONTENIDO', now(), now()),
  (gen_random_uuid(), 'Reel',       'CONTENIDO', now(), now())
ON CONFLICT ("name") DO NOTHING;
