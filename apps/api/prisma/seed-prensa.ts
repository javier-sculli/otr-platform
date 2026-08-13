import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tipos de tarea de Prensa (HU Fase 2). Idempotente: se puede correr varias veces.
// Publicables + gestión/proceso. `Gestión-pitch` habilita campos medio/periodista/respuesta.
const PRENSA_TYPES = [
  // Publicables
  'Comunicado',
  'Columna de opinión',
  'Cuestionario/Vocería',
  'Documento',
  // Gestión / proceso
  'Gestión-pitch',
  'Clipping',
  'Evento',
  'Brief',
  'Feedback',
  'Estrategia',
  'Base de Medios',
];

async function main() {
  console.log('🌱 Seeding tipos de Prensa...');
  for (const name of PRENSA_TYPES) {
    await prisma.ticketType.upsert({
      where: { name_kind: { name, kind: 'PRENSA' } },
      update: { kind: 'PRENSA' },
      create: { name, kind: 'PRENSA' },
    });
  }

  console.log('🌱 Seeding tipos de Tarea...');
  const TAREA_TYPES = ['Base de Medios', 'News', 'Blog', 'Deck', 'Estrategia', 'Reporte', 'Diseño puntual', 'Otro'];
  for (const name of TAREA_TYPES) {
    await prisma.ticketType.upsert({
      where: { name_kind: { name, kind: 'TAREA' } },
      update: { kind: 'TAREA' },
      create: { name, kind: 'TAREA' },
    });
  }

  console.log(`✅ ${PRENSA_TYPES.length} tipos de Prensa y ${TAREA_TYPES.length} tipos de Tarea listos`);
}

main()
  .catch((e) => {
    console.error('❌ seed-prensa failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
