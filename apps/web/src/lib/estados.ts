// Catálogo de estados de Prensa (HU Fase 2) — presentación para el board.
// Espejo de PRENSA_SUBESTADOS en @otr/types (no consumido en runtime por el web).

export type MacroEstado = 'BACKLOG' | 'EN_PROGRESO' | 'EN_REVISION' | 'FINALIZADO';
export type GeneralStatus = MacroEstado;

export type SubEstado =
  | 'PENDIENTE' | 'EN_CURSO' | 'REVISION_INTERNA'
  | 'ENVIADO_CLIENTE' | 'LISTO' | 'CANCELADO';

export interface MacroDef {
  id: GeneralStatus;
  label: string;
  color: string;   // fondo header de columna
  border: string;  // borde de columna
}

export interface SubDef {
  sub: SubEstado;
  macro: GeneralStatus;
  label: string;
  chip: string;    // clases del chip de subestado
}

// Orden de macro-columnas + estilo (paleta del sistema: #000033 / #024fff / #00ff99).
export const MACROS: MacroDef[] = [
  { id: 'BACKLOG',     label: 'Backlog',      color: 'bg-[#000033]/5',  border: 'border-[#000033]/20' },
  { id: 'EN_PROGRESO', label: 'En progreso',  color: 'bg-[#024fff]/5',  border: 'border-[#024fff]/20' },
  { id: 'EN_REVISION', label: 'En revisión',  color: 'bg-[#024fff]/15', border: 'border-[#024fff]/30' },
  { id: 'FINALIZADO',  label: 'Finalizado',   color: 'bg-[#00ff99]/15', border: 'border-[#00ff99]/40' },
];

// Subestados de Prensa en orden, con su macro y estilo de chip.
export const PRENSA_SUBESTADOS: SubDef[] = [
  { sub: 'PENDIENTE',        macro: 'BACKLOG',     label: 'Pendiente',              chip: 'bg-[#000033]/10 text-[#000033] border-[#000033]/25' },
  { sub: 'EN_CURSO',         macro: 'EN_PROGRESO', label: 'Ongoing',                chip: 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30' },
  { sub: 'REVISION_INTERNA', macro: 'EN_REVISION', label: 'En revisión interna',    chip: 'bg-[#024fff]/15 text-[#024fff] border-[#024fff]/35' },
  { sub: 'ENVIADO_CLIENTE',  macro: 'EN_REVISION', label: 'En revisión del cliente', chip: 'bg-[#024fff]/20 text-[#024fff] border-[#024fff]/40' },
  { sub: 'LISTO',            macro: 'FINALIZADO',  label: 'Completado',             chip: 'bg-[#00ff99]/30 text-[#000033] border-[#00ff99]/50' },
  { sub: 'CANCELADO',        macro: 'FINALIZADO',  label: 'Cancelado',              chip: 'bg-[#000033]/5 text-[#000033]/40 border-[#000033]/15' },
];

// Subestado default al soltar una card en cada macro-columna.
export const MACRO_DEFAULT_SUB: Record<GeneralStatus, SubEstado> = {
  BACKLOG: 'PENDIENTE',
  EN_PROGRESO: 'EN_CURSO',
  EN_REVISION: 'REVISION_INTERNA',
  FINALIZADO: 'LISTO',
};

export const SUB_DEF: Record<SubEstado, SubDef> =
  Object.fromEntries(PRENSA_SUBESTADOS.map((d) => [d.sub, d])) as Record<SubEstado, SubDef>;

export function subEstadoToMacro(sub: SubEstado): GeneralStatus {
  return SUB_DEF[sub]?.macro ?? 'BACKLOG';
}

export function subsDeMacro(macro: GeneralStatus): SubDef[] {
  return PRENSA_SUBESTADOS.filter((d) => d.macro === macro);
}

// Tipos de Prensa que habilitan campos de gestión-pitch (medio/periodista/respuesta).
export const TIPO_GESTION_PITCH = 'Gestión-pitch';

export const ESTADO_RESPUESTA_LABEL: Record<string, string> = {
  ENVIADO: 'Enviado',
  RESPONDIDO: 'Respondido',
  SIN_RESPUESTA: 'Sin respuesta',
};
