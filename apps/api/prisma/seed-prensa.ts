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
];

async function main() {
  console.log('🌱 Seeding tipos de Prensa...');
  for (const name of PRENSA_TYPES) {
    await prisma.ticketType.upsert({
      where: { name },
      update: { kind: 'PRENSA' },
      create: { name, kind: 'PRENSA' },
    });
  }
  console.log(`✅ ${PRENSA_TYPES.length} tipos de Prensa listos`);
}

main()
  .catch((e) => {
    console.error('❌ seed-prensa failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
