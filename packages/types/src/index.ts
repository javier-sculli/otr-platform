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
export interface TicketType {
  id: string;
  name: string;
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
  dueDate?: Date;
  links: string[];
  createdAt: Date;
  updatedAt: Date;
  // Relations
  client?: Client;
  owner?: User;
  area?: Area;
  ticketType?: TicketType;
  publication?: Publication;
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
