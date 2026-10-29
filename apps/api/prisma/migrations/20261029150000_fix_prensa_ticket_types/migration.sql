-- Fix tipo_ticket for Prensa tickets
UPDATE "tickets" SET "tipo_ticket" = 'PRENSA' WHERE "area" = 'PRENSA';

-- Re-point ticket_type_id to PRENSA types for Prensa tickets
UPDATE "tickets" t
SET "ticket_type_id" = tt_prensa."id"
FROM "ticket_types" tt_tarea
JOIN "ticket_types" tt_prensa ON tt_prensa."name" = tt_tarea."name" AND tt_prensa."kind" = 'PRENSA'
WHERE t."ticket_type_id" = tt_tarea."id"
  AND tt_tarea."kind" = 'TAREA'
  AND t."area" = 'PRENSA';
