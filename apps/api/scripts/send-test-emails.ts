import { sendNotificationEmail, NotificationEmailPayload } from '../src/lib/email.js';

const TARGET_EMAIL = process.argv[2] || 'javier.sculli@gmail.com';

console.log(`\n🚀 Iniciando envío de ejemplos de notificación por correo a: ${TARGET_EMAIL}\n`);

const examples: { name: string; payload: NotificationEmailPayload }[] = [
  {
    name: '1. Mención en Comentario (MENTION)',
    payload: {
      to: TARGET_EMAIL,
      type: 'MENTION',
      fromName: 'Manuela Ghitta',
      ticketId: 'ticket-mencion-001',
      ticketTitle: 'Estrategia de Redes Q3 - Mercado Libre',
      clientName: 'Mercado Libre',
      commentContent: '@Javi Sculli revisé la propuesta de copy para LinkedIn y sumé los CTAs hacia la landing. Decime si te parece ok para pasarlo a la etapa de Diseño.',
    },
  },
  {
    name: '2. Asignación de Ticket (ASSIGNED)',
    payload: {
      to: TARGET_EMAIL,
      type: 'ASSIGNED',
      fromName: 'Joaquín Tagle',
      ticketId: 'ticket-asignacion-002',
      ticketTitle: 'Deck Presentación de Métricas - Coca-Cola',
      clientName: 'Coca-Cola',
      ticketTypeName: 'Deck / Estrategia',
      dueDateFormatted: '28 de Agosto, 2026',
    },
  },
  {
    name: '3. Cambio de Estado (STATUS_CHANGE)',
    payload: {
      to: TARGET_EMAIL,
      type: 'STATUS_CHANGE',
      fromName: 'Shaiel Terán',
      ticketId: 'ticket-estado-003',
      ticketTitle: 'Placa Instagram Anuncio - Globant',
      clientName: 'Globant',
      oldStatusLabel: 'En Progreso',
      newStatusLabel: 'En Revisión Interna',
    },
  },
];

async function run() {
  for (const example of examples) {
    console.log(`Enviando [${example.name}]...`);
    const result = await sendNotificationEmail(example.payload);
    if (result.success) {
      console.log(`✅ Enviado exitosamente (Resend ID: ${result.id})\n`);
    } else {
      console.error(`❌ Error enviando [${example.name}]:`, result.error, '\n');
    }
  }
  console.log(`🏁 Proceso completado.\n`);
}

run();
