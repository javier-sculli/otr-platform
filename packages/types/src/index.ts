// User types
export enum UserRole {
  CONTENIDISTA = 'CONTENIDISTA',
  COORDINADOR = 'COORDINADOR',
  DIRECCION = 'DIRECCION',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  areaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Client types
export interface Client {
  id: string;
  name: string;
  active: boolean;
  monthlyContentTarget?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Area types
export interface Area {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// TicketType types
export enum TicketTypeKind {
  CONTENIDO = 'CONTENIDO',
  TAREA = 'TAREA',
  PRENSA = 'PRENSA',
}

export interface TicketType {
  id: string;
  name: string;
  kind: TicketTypeKind;
  createdAt: Date;
  updatedAt: Date;
}

// Ticket types
export enum TicketStatus {
  BACKLOG = 'BACKLOG',
  EN_PROGRESO = 'EN_PROGRESO',
  REVISION = 'REVISION',
  BLOQUEADO = 'BLOQUEADO',
  CERRADO = 'CERRADO',
}

export enum TicketCloseReason {
  PUBLICADO = 'PUBLICADO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

// Modelo de estado de dos niveles (HU Fase 2) — Prensa.
// Contenido conserva su flujo plano (`TicketStatus`) en esta iteración.
export enum TicketArea {
  CONTENIDO = 'CONTENIDO',
  PRENSA = 'PRENSA',
}

export enum MacroEstado {
  BACKLOG = 'BACKLOG',
  EN_PROGRESO = 'EN_PROGRESO',
  EN_REVISION = 'EN_REVISION',
  FINALIZADO = 'FINALIZADO',
}

export type GeneralStatus = MacroEstado;
export const GeneralStatus = MacroEstado;

export enum SubEstado {
  STAND_BY = 'STAND_BY',
  PENDIENTE = 'PENDIENTE',
  EN_CURSO = 'EN_CURSO',
  REV_SANTI = 'REV_SANTI',
  REV_MANU = 'REV_MANU',
  ENVIADO_CLIENTE = 'ENVIADO_CLIENTE',
  A_PUBLICAR = 'A_PUBLICAR',
  LISTO = 'LISTO',
  CANCELADO = 'CANCELADO',
}

export enum EstadoRespuesta {
  ENVIADO = 'ENVIADO',
  RESPONDIDO = 'RESPONDIDO',
  SIN_RESPUESTA = 'SIN_RESPUESTA',
}

export interface SubEstadoDef {
  sub: SubEstado;
  macro: MacroEstado;
  label: string;
}

// Catálogo de subestados de Prensa, en orden. Cada subestado pertenece a un
// único macroEstado. Fuente única reutilizada por backend (derivar macro) y
// frontend (columnas, chips, labels).
export const PRENSA_SUBESTADOS: SubEstadoDef[] = [
  { sub: SubEstado.STAND_BY,        macro: MacroEstado.BACKLOG,     label: 'Stand by' },
  { sub: SubEstado.PENDIENTE,       macro: MacroEstado.BACKLOG,     label: 'Pendiente' },
  { sub: SubEstado.EN_CURSO,        macro: MacroEstado.EN_PROGRESO, label: 'En curso' },
  { sub: SubEstado.REV_SANTI,       macro: MacroEstado.EN_REVISION, label: 'Rev. Santi' },
  { sub: SubEstado.REV_MANU,        macro: MacroEstado.EN_REVISION, label: 'Rev. Manu' },
  { sub: SubEstado.ENVIADO_CLIENTE, macro: MacroEstado.EN_REVISION, label: 'Enviado al cliente' },
  { sub: SubEstado.A_PUBLICAR,      macro: MacroEstado.FINALIZADO,  label: 'A publicar' },
  { sub: SubEstado.LISTO,           macro: MacroEstado.FINALIZADO,  label: 'Listo' },
  { sub: SubEstado.CANCELADO,       macro: MacroEstado.FINALIZADO,  label: 'Cancelado' },
];

// Orden de las macro-columnas del backlog.
export const MACRO_ESTADOS: MacroEstado[] = [
  MacroEstado.BACKLOG,
  MacroEstado.EN_PROGRESO,
  MacroEstado.EN_REVISION,
  MacroEstado.FINALIZADO,
];

export const MACRO_ESTADO_LABEL: Record<MacroEstado, string> = {
  [MacroEstado.BACKLOG]: 'Backlog',
  [MacroEstado.EN_PROGRESO]: 'En progreso',
  [MacroEstado.EN_REVISION]: 'En revisión',
  [MacroEstado.FINALIZADO]: 'Finalizado',
};

// Subestado default al soltar una card en cada macro-columna (densidad compacta).
export const MACRO_DEFAULT_SUBESTADO: Record<MacroEstado, SubEstado> = {
  [MacroEstado.BACKLOG]: SubEstado.PENDIENTE,
  [MacroEstado.EN_PROGRESO]: SubEstado.EN_CURSO,
  [MacroEstado.EN_REVISION]: SubEstado.REV_SANTI,
  [MacroEstado.FINALIZADO]: SubEstado.LISTO,
};

export enum EstadoAprobacionCliente {
  BORRADOR = 'BORRADOR',
  ENVIADO_AL_CLIENTE = 'ENVIADO_AL_CLIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  REQUIERE_AJUSTES = 'REQUIERE_AJUSTES',
}

/** Deriva el macroEstado de un subestado de Prensa. */
export function subEstadoToMacro(sub: SubEstado): MacroEstado {
  const def = PRENSA_SUBESTADOS.find((d) => d.sub === sub);
  if (!def) throw new Error(`SubEstado desconocido: ${sub}`);
  return def.macro;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  ownerId: string;
  areaId: string;
  ticketTypeId: string;
  status: TicketStatus;
  closeReason?: TicketCloseReason;
  area: TicketArea;
  macroEstado?: MacroEstado;
  subEstado?: SubEstado;
  medio?: string;
  periodista?: string;
  estadoRespuesta?: EstadoRespuesta;
  dueDate?: Date;
  plannedDate?: Date;
  isDraftPlan?: boolean;
  publishedAt?: Date;
  estadoAprobacionCliente?: EstadoAprobacionCliente;
  links: string[];
  createdAt: Date;
  updatedAt: Date;
  // Relations
  client?: Client;
  owner?: User;
  ticketType?: TicketType;
  publication?: Publication;
  references?: Pick<Ticket, 'id' | 'title' | 'status'>[];
}

// Publication types
export interface Publication {
  id: string;
  ticketId: string;
  url: string;
  publishedAt: Date;
  metrics: Record<string, any>; // Flexible JSON
  insights?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  ticket?: Ticket;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface AuthenticatedUser extends User {
  token: string;
}
