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
export const createTicketTypeSchema = z.object({
  name: z.string().min(1),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

// Ticket schemas
export const ticketStatusSchema = z.enum(['BACKLOG', 'EN_PROGRESO', 'REVISION', 'BLOQUEADO', 'CERRADO']);

export const ticketCloseReasonSchema = z.enum(['PUBLICADO', 'ENTREGADO', 'CANCELADO']);

export const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  areaId: z.string().uuid(),
  ticketTypeId: z.string().uuid(),
  status: ticketStatusSchema.default('BACKLOG'),
  dueDate: z.string().datetime().optional(),
  links: z.array(z.string().url()).default([]),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  ticketTypeId: z.string().uuid().optional(),
  status: ticketStatusSchema.optional(),
  closeReason: ticketCloseReasonSchema.optional(),
  dueDate: z.string().datetime().optional().nullable(),
  links: z.array(z.string().url()).optional(),
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
  status: ticketStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
