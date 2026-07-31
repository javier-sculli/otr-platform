import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export interface CalendarWeekRange {
  weekNumber: number;
  startDay: number;
  endDay: number;
  label: string;
}

export function getCalendarWeeks(year: number, month: number): CalendarWeekRange[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthNamesEs = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const monthLabel = monthNamesEs[month - 1].slice(0, 3);

  const weeks: CalendarWeekRange[] = [];
  let currentStart = 1;
  let weekNum = 1;

  while (currentStart <= daysInMonth) {
    const dateObj = new Date(year, month - 1, currentStart);
    const jsDay = dateObj.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const daysUntilSunday = jsDay === 0 ? 0 : 7 - jsDay;

    let currentEnd = currentStart + daysUntilSunday;
    if (currentEnd > daysInMonth) {
      currentEnd = daysInMonth;
    }

    weeks.push({
      weekNumber: weekNum,
      startDay: currentStart,
      endDay: currentEnd,
      label: `Semana ${weekNum} (${currentStart} al ${currentEnd} ${monthLabel})`,
    });

    currentStart = currentEnd + 1;
    weekNum++;
  }

  return weeks;
}

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /reports/cumplimiento-clientes?year=2026&month=7
  fastify.get('/cumplimiento-clientes', async (request, reply) => {
    const user = request.user as { id: string; email: string; role: string };

    // Verificación de acceso para Directoras / Admins
    const isDirectorOrAdmin =
      user.role === 'DIRECCION' ||
      ['javier', 'javi', 'joaco', 'manu', 'manuela'].some((name) =>
        user.email.toLowerCase().includes(name)
      );

    if (!isDirectorOrAdmin) {
      return reply.status(403).send({
        error: 'Acceso restringido: Esta sección solo está disponible para la Dirección.',
      });
    }

    const { year: yearQuery, month: monthQuery } = request.query as {
      year?: string;
      month?: string;
    };

    const now = new Date();
    const year = yearQuery ? parseInt(yearQuery, 10) : now.getFullYear();
    const month = monthQuery ? parseInt(monthQuery, 10) : now.getMonth() + 1; // 1-indexed (1-12)

    // Fechas de inicio y fin del mes
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Calcular Semanas Calendario reales (Lunes a Domingo)
    const calendarWeeks = getCalendarWeeks(year, month);

    // Obtener todos los tickets del mes (sin filtrar por cliente para el resumen global)
    const allTicketsMonth = await prisma.ticket.findMany({
      where: {
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { plannedDate: { gte: startDate, lte: endDate } },
          { dueDate: { gte: startDate, lte: endDate } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        ticketType: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Backlog general (tickets pendientes sin fecha o pendientes en general)
    const backlogGeneralCount = await prisma.ticket.count({
      where: {
        status: { in: ['PENDIENTE'] },
      },
    });

    // Obtener todos los clientes activos con sus tickets del mes
    const clients = await prisma.client.findMany({
      where: { active: true },
      include: {
        owner: { select: { id: true, name: true } },
        tickets: {
          where: {
            OR: [
              { createdAt: { gte: startDate, lte: endDate } },
              { plannedDate: { gte: startDate, lte: endDate } },
              { dueDate: { gte: startDate, lte: endDate } },
            ],
          },
          include: {
            owner: { select: { id: true, name: true } },
            ticketType: { select: { id: true, name: true, kind: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const nowMs = now.getTime();
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

    // Resumen General del Mes
    const publicadasListasCount = allTicketsMonth.filter((t) =>
      ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO'].includes(t.status)
    ).length;

    const enProgresoCount = allTicketsMonth.filter((t) =>
      [
        'REDACCION',
        'DISENO',
        'EDICION',
        'REVISION_INTERNA',
        'CLIENTE',
        'ESPERANDO_FEEDBACK',
      ].includes(t.status)
    ).length;

    const backlogMesCount = allTicketsMonth.filter((t) =>
      ['PENDIENTE'].includes(t.status)
    ).length;

    // Resumen Global por Semana Calendario
    const weeksSummary = calendarWeeks.map((w) => {
      const ticketsInWeek = allTicketsMonth.filter((t) => {
        const refDate = t.plannedDate || t.dueDate || t.createdAt;
        const d = new Date(refDate).getDate();
        return d >= w.startDay && d <= w.endDay;
      });

      const completadas = ticketsInWeek.filter((t) =>
        ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO'].includes(t.status)
      ).length;

      const enProgreso = ticketsInWeek.filter((t) =>
        [
          'REDACCION',
          'DISENO',
          'EDICION',
          'REVISION_INTERNA',
          'CLIENTE',
          'ESPERANDO_FEEDBACK',
        ].includes(t.status)
      ).length;

      const atrasadas = ticketsInWeek.filter((t) => {
        const targetDate = t.plannedDate || t.dueDate;
        if (!targetDate) return false;
        const isClosed = ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO', 'CANCELADO'].includes(
          t.status
        );
        return !isClosed && new Date(targetDate).getTime() < nowMs;
      }).length;

      const total = ticketsInWeek.length;
      const percentCumplimiento = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        weekNumber: w.weekNumber,
        label: w.label,
        startDay: w.startDay,
        endDay: w.endDay,
        total,
        completadas,
        enProgreso,
        atrasadas,
        percentCumplimiento,
      };
    });

    let globalTotalTickets = 0;
    let globalTotalTarget = 0;
    let globalEnRiesgo = 0;
    let globalAtrasadas = 0;

    const clientsReport = clients.map((client) => {
      const tickets = client.tickets;

      let publicadasCount = 0;
      let enRiesgoCount = 0;
      let atrasadasCount = 0;
      let enFechaCount = 0;

      const ticketsEnRiesgo: any[] = [];
      const ticketsAtrasados: any[] = [];

      // Desglose detallado por semana calendario para este cliente
      const weeksBreakdown = calendarWeeks.map((w) => {
        const weekTickets = tickets.filter((t) => {
          const refDate = t.plannedDate || t.dueDate || t.createdAt;
          const d = new Date(refDate).getDate();
          return d >= w.startDay && d <= w.endDay;
        });

        const completadas = weekTickets.filter((t) =>
          ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO'].includes(t.status)
        ).length;

        const enProgreso = weekTickets.filter((t) =>
          [
            'REDACCION',
            'DISENO',
            'EDICION',
            'REVISION_INTERNA',
            'CLIENTE',
            'ESPERANDO_FEEDBACK',
          ].includes(t.status)
        ).length;

        const atrasadas = weekTickets.filter((t) => {
          const targetDate = t.plannedDate || t.dueDate;
          if (!targetDate) return false;
          const isClosed = ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO', 'CANCELADO'].includes(
            t.status
          );
          return !isClosed && new Date(targetDate).getTime() < nowMs;
        }).length;

        const total = weekTickets.length;

        return {
          weekNumber: w.weekNumber,
          startDay: w.startDay,
          endDay: w.endDay,
          total,
          completadas,
          enProgreso,
          atrasadas,
        };
      });

      tickets.forEach((ticket) => {
        const isClosedOrPublished = [
          'PUBLICADO',
          'LISTO_PARA_PUBLICAR',
          'LISTO',
        ].includes(ticket.status);

        const targetDate = ticket.plannedDate || ticket.dueDate;
        const targetMs = targetDate ? new Date(targetDate).getTime() : null;

        if (isClosedOrPublished) {
          publicadasCount++;
        } else if (ticket.status === 'CANCELADO') {
          // No cuenta en atrasos
        } else if (targetMs && targetMs < nowMs) {
          atrasadasCount++;
          ticketsAtrasados.push({
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            dueDate: ticket.dueDate,
            plannedDate: ticket.plannedDate,
            ownerName: ticket.owner?.name ?? 'Sin asignar',
            typeName: ticket.ticketType?.name ?? 'General',
          });
        } else if (
          targetMs &&
          targetMs - nowMs <= FORTY_EIGHT_HOURS_MS &&
          ['PENDIENTE', 'REDACCION', 'DISENO'].includes(ticket.status)
        ) {
          enRiesgoCount++;
          ticketsEnRiesgo.push({
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            dueDate: ticket.dueDate,
            plannedDate: ticket.plannedDate,
            ownerName: ticket.owner?.name ?? 'Sin asignar',
            typeName: ticket.ticketType?.name ?? 'General',
          });
        } else {
          enFechaCount++;
        }
      });

      const totalMonth = tickets.length;
      const target = client.monthlyContentTarget ?? 0;
      const percentCumplimiento = target > 0 ? Math.round((totalMonth / target) * 100) : null;

      globalTotalTickets += totalMonth;
      if (target > 0) globalTotalTarget += target;
      globalEnRiesgo += enRiesgoCount;
      globalAtrasadas += atrasadasCount;

      const contenidoCount = tickets.filter(
        (t) => t.ticketType?.kind === 'CONTENIDO' || t.area === 'CONTENIDO'
      ).length;
      const tareasCount = tickets.filter((t) => t.ticketType?.kind === 'TAREA').length;
      const prensaCount = tickets.filter(
        (t) => t.ticketType?.kind === 'PRENSA' || t.area === 'PRENSA'
      ).length;

      return {
        id: client.id,
        name: client.name,
        monthlyContentTarget: target,
        totalMonth,
        percentCumplimiento,
        weeksBreakdown,
        statusBreakdown: {
          publicadas: publicadasCount,
          enRiesgo: enRiesgoCount,
          atrasadas: atrasadasCount,
          enFecha: enFechaCount,
        },
        typeBreakdown: {
          contenido: contenidoCount,
          tareas: tareasCount,
          prensa: prensaCount,
        },
        ticketsEnRiesgo,
        ticketsAtrasados,
      };
    });

    const percentGlobalTarget =
      globalTotalTarget > 0 ? Math.round((globalTotalTickets / globalTotalTarget) * 100) : null;

    return {
      data: {
        period: { year, month },
        calendarWeeks,
        summary: {
          totalTickets: globalTotalTickets,
          totalTarget: globalTotalTarget,
          percentGlobalTarget,
          publicadasListas: publicadasListasCount,
          enProgreso: enProgresoCount,
          backlogMes: backlogMesCount,
          backlogGeneral: backlogGeneralCount,
          enRiesgo: globalEnRiesgo,
          atrasadas: globalAtrasadas,
          activeClientsCount: clients.length,
        },
        weeksSummary,
        clients: clientsReport,
      },
    };
  });
}
