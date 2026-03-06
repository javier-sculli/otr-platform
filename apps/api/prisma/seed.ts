import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create areas
  const areaContenido = await prisma.area.upsert({
    where: { name: 'Contenido' },
    update: {},
    create: { name: 'Contenido' },
  });

  const areaDiseno = await prisma.area.upsert({
    where: { name: 'Diseño' },
    update: {},
    create: { name: 'Diseño' },
  });

  console.log('✅ Areas created');

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin@otr.com' },
    update: {},
    create: {
      email: 'admin@otr.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'DIRECCION',
      areaId: areaContenido.id,
    },
  });

  const userContenidista = await prisma.user.upsert({
    where: { email: 'contenidista@otr.com' },
    update: {},
    create: {
      email: 'contenidista@otr.com',
      password: hashedPassword,
      name: 'Ana Contenidista',
      role: 'CONTENIDISTA',
      areaId: areaContenido.id,
    },
  });

  console.log('✅ Users created (password: password123)');

  // Create clients
  let clientA = await prisma.client.findFirst({
    where: { name: 'Cliente A' },
  });
  if (!clientA) {
    clientA = await prisma.client.create({
      data: { name: 'Cliente A', active: true },
    });
  }

  let clientB = await prisma.client.findFirst({
    where: { name: 'Cliente B' },
  });
  if (!clientB) {
    clientB = await prisma.client.create({
      data: { name: 'Cliente B', active: true },
    });
  }

  console.log('✅ Clients created');

  // Create ticket types
  const typePost = await prisma.ticketType.upsert({
    where: { name: 'Post RRSS' },
    update: {},
    create: { name: 'Post RRSS' },
  });

  const typeArticulo = await prisma.ticketType.upsert({
    where: { name: 'Artículo Blog' },
    update: {},
    create: { name: 'Artículo Blog' },
  });

  const typeVideo = await prisma.ticketType.upsert({
    where: { name: 'Video' },
    update: {},
    create: { name: 'Video' },
  });

  console.log('✅ Ticket types created');

  // Create sample tickets
  await prisma.ticket.create({
    data: {
      title: 'Post liderazgo – semana 1',
      objetivo: 'Posicionar al vocero como referente en tecnología',
      description: 'Evitar tono corporativo. Incluir caso de uso real.',
      canal: 'LinkedIn',
      clientId: clientA.id,
      ownerId: userAdmin.id,
      areaId: areaContenido.id,
      ticketTypeId: typePost.id,
      status: 'CONTENIDO',
      prioridad: 'ALTA',
      dueDate: new Date('2026-03-12'),
      links: ['https://drive.google.com/folder123'],
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Thread educativo – producto nuevo',
      objetivo: 'Explicar features clave del producto de forma simple',
      description: 'Usar ejemplos concretos y evitar jerga técnica.',
      canal: 'Twitter',
      clientId: clientB.id,
      ownerId: userContenidista.id,
      areaId: areaContenido.id,
      ticketTypeId: typePost.id,
      status: 'BACKLOG',
      prioridad: 'MEDIA',
      dueDate: new Date('2026-03-15'),
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Carousel tips – onboarding',
      objetivo: 'Ayudar a nuevos usuarios a empezar rápido',
      canal: 'Instagram',
      clientId: clientA.id,
      ownerId: userContenidista.id,
      areaId: areaContenido.id,
      ticketTypeId: typePost.id,
      status: 'APROBADO',
      prioridad: 'MEDIA',
      dueDate: new Date('2026-03-08'),
      links: ['https://instagram.com/p/ejemplo123'],
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Video testimonial – caso éxito',
      objetivo: 'Mostrar resultados reales de clientes',
      canal: 'LinkedIn',
      clientId: clientB.id,
      ownerId: userAdmin.id,
      areaId: areaContenido.id,
      ticketTypeId: typeVideo.id,
      status: 'DISENO',
      prioridad: 'ALTA',
      dueDate: new Date('2026-03-18'),
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Artículo SEO sobre tendencias 2026',
      objetivo: 'Posicionamiento orgánico para keywords clave',
      description: 'Artículo de 1500 palabras con datos de investigación.',
      clientId: clientB.id,
      ownerId: userContenidista.id,
      areaId: areaContenido.id,
      ticketTypeId: typeArticulo.id,
      status: 'BRIEF',
      prioridad: 'BAJA',
      dueDate: new Date('2026-03-20'),
    },
  });

  console.log('✅ Sample tickets created');

  console.log('🎉 Seed completed!');
  console.log('\nTest users:');
  console.log('- admin@otr.com / password123 (DIRECCION)');
  console.log('- contenidista@otr.com / password123 (CONTENIDISTA)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
