import { z } from 'zod';

// User schemas
export const userRoleSchema = z.enum(['CONTENIDISTA', 'COORDINADOR', 'DIRECCION']);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: userRoleSchema,
  areaId: z.string().uuid().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Client schemas
export const createClientSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
});

export const updateClientSchema = createClientSchema.partial();

// Area schemas
export const createAreaSchema = z.object({
  name: z.string().min(1),
});

export const updateAreaSchema = createAreaSchema.partial();

// TicketType schemas
export const ticketTypeKindSchema = z.enum(['CONTENIDO', 'TAREA', 'PRENSA']);

export const createTicketTypeSchema = z.object({
  name: z.string().min(1),
  kind: ticketTypeKindSchema.default('CONTENIDO'),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

// Ticket schemas
export const ticketStatusSchema = z.enum(['BACKLOG', 'EN_PROGRESO', 'REVISION', 'BLOQUEADO', 'CERRADO']);

export const ticketCloseReasonSchema = z.enum(['PUBLICADO', 'ENTREGADO', 'CANCELADO']);

// Modelo de dos niveles (HU Fase 2)
export const ticketAreaSchema = z.enum(['CONTENIDO', 'PRENSA']);
export const macroEstadoSchema = z.enum(['BACKLOG', 'EN_PROGRESO', 'EN_REVISION', 'FINALIZADO']);
export const generalStatusSchema = macroEstadoSchema;
export const subEstadoSchema = z.enum([
  'STAND_BY', 'PENDIENTE', 'EN_CURSO', 'REV_SANTI', 'REV_MANU',
  'ENVIADO_CLIENTE', 'A_PUBLICAR', 'LISTO', 'CANCELADO',
]);
export const estadoRespuestaSchema = z.enum(['ENVIADO', 'RESPONDIDO', 'SIN_RESPUESTA']);
export const estadoAprobacionClienteSchema = z.enum(['BORRADOR', 'ENVIADO_AL_CLIENTE', 'APROBADO', 'RECHAZADO', 'REQUIERE_AJUSTES']);

export const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  areaId: z.string().uuid().optional(),
  ticketTypeId: z.string().uuid().optional(),
  status: ticketStatusSchema.default('BACKLOG'),
  area: ticketAreaSchema.default('CONTENIDO'),
  subEstado: subEstadoSchema.optional(),
  medio: z.string().optional(),
  periodista: z.string().optional(),
  estadoRespuesta: estadoRespuestaSchema.optional(),
  dueDate: z.string().optional().nullable(),
  plannedDate: z.string().optional().nullable(),
  isDraftPlan: z.boolean().default(false),
  estadoAprobacionCliente: estadoAprobacionClienteSchema.default('BORRADOR'),
  publishedAt: z.string().optional().nullable(),
  links: z.array(z.string()).default([]),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  ticketTypeId: z.string().uuid().optional().nullable(),
  status: ticketStatusSchema.optional(),
  closeReason: ticketCloseReasonSchema.optional(),
  area: ticketAreaSchema.optional(),
  subEstado: subEstadoSchema.optional().nullable(),
  medio: z.string().optional().nullable(),
  periodista: z.string().optional().nullable(),
  estadoRespuesta: estadoRespuestaSchema.optional().nullable(),
  dueDate: z.string().optional().nullable(),
  plannedDate: z.string().optional().nullable(),
  isDraftPlan: z.boolean().optional(),
  estadoAprobacionCliente: estadoAprobacionClienteSchema.optional(),
  publishedAt: z.string().optional().nullable(),
  links: z.array(z.string()).optional(),
  referenceIds: z.array(z.string().uuid()).max(3).optional(),
});

// Publication schemas
export const createPublicationSchema = z.object({
  ticketId: z.string().uuid(),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  metrics: z.record(z.any()).default({}),
  insights: z.string().optional(),
});

export const updatePublicationSchema = z.object({
  url: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
  metrics: z.record(z.any()).optional(),
  insights: z.string().optional(),
});

// Query schemas
export const ticketListQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  area: ticketAreaSchema.optional(),
  status: ticketStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
