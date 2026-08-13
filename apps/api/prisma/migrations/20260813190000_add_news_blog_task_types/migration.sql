-- Add News and Blog as TAREA (deliverable) ticket types — idempotent
INSERT INTO "ticket_types" ("id", "name", "kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'News', 'TAREA', now(), now()),
  (gen_random_uuid(), 'Blog', 'TAREA', now(), now())
ON CONFLICT ("name", "kind") DO NOTHING;
