import { prisma } from '../lib/prisma.js';

interface AuditOptions {
  hours?: number;
  json?: boolean;
}

interface IssueItem {
  type: 'ATTACHMENT_BROKEN' | 'ORPHAN_INLINE_MARK' | 'MISSING_DELIVERABLE' | 'EMPTY_DESCRIPTION';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  ticketId: string;
  ticketTitle: string;
  clientName: string;
  detail: string;
  context?: any;
}

export async function runTicketIntegrityAudit(options: AuditOptions = {}) {
  const hours = options.hours ?? 36;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const issues: IssueItem[] = [];

  // 1. Auditar comentarios creados/modificados en la ventana
  const recentComments = await prisma.ticketComment.findMany({
    where: {
      OR: [
        { createdAt: { gte: since } },
        { updatedAt: { gte: since } },
      ],
    },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          client: { select: { name: true } },
        },
      },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let commentsWithImagesCount = 0;
  let attachmentsFoundCount = 0;

  for (const comment of recentComments) {
    const text = comment.content || '';
    const attachmentMatches = Array.from(text.matchAll(/\/tickets\/attachments\/([a-zA-Z0-9_-]+)/g));
    const isMarkdownImage = text.includes('![') || attachmentMatches.length > 0;

    if (isMarkdownImage) {
      commentsWithImagesCount++;
    }

    // Verificar si hay markdown de imagen roto tipo ![imagen]() o ![imagen](undefined)
    const brokenMdMatch = text.match(/!\[([^\]]*)\]\((undefined|null|)\)/i);
    if (brokenMdMatch) {
      issues.push({
        type: 'ATTACHMENT_BROKEN',
        severity: 'HIGH',
        ticketId: comment.ticketId,
        ticketTitle: comment.ticket?.title || 'Sin título',
        clientName: comment.ticket?.client?.name || 'Desconocido',
        detail: `Comentario contiene sintaxis de imagen vacía o rota: "${brokenMdMatch[0]}"`,
        context: { commentId: comment.id, author: comment.user?.name },
      });
    }

    // Verificar existencia real en la tabla CommentAttachment
    for (const match of attachmentMatches) {
      attachmentsFoundCount++;
      const attachmentId = match[1];
      const attachmentRecord = await prisma.commentAttachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, size: true, mimeType: true },
      });

      if (!attachmentRecord) {
        issues.push({
          type: 'ATTACHMENT_BROKEN',
          severity: 'HIGH',
          ticketId: comment.ticketId,
          ticketTitle: comment.ticket?.title || 'Sin título',
          clientName: comment.ticket?.client?.name || 'Desconocido',
          detail: `Adjunto referenciado (/tickets/attachments/${attachmentId}) no existe en base de datos`,
          context: { commentId: comment.id, attachmentId },
        });
      } else if (attachmentRecord.size <= 0) {
        issues.push({
          type: 'ATTACHMENT_BROKEN',
          severity: 'HIGH',
          ticketId: comment.ticketId,
          ticketTitle: comment.ticket?.title || 'Sin título',
          clientName: comment.ticket?.client?.name || 'Desconocido',
          detail: `Adjunto (${attachmentId}) tiene tamaño 0 bytes`,
          context: { commentId: comment.id, attachmentId },
        });
      }
    }
  }

  // 2. Auditar tickets modificados recientemente
  const recentTickets = await prisma.ticket.findMany({
    where: {
      updatedAt: { gte: since },
    },
    select: {
      id: true,
      title: true,
      status: true,
      tipoTicket: true,
      objetivo: true,
      notasAudiovisual: true,
      contentPerCanal: true,
      linkEntregable: true,
      links: true,
      tiposContenido: true,
      client: { select: { name: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Conjunto de comentarios de tickets recientes para verificar marcas huérfanas
  const ticketIds = recentTickets.map(t => t.id);
  const activeComments = await prisma.ticketComment.findMany({
    where: { ticketId: { in: ticketIds } },
    select: { id: true, ticketId: true },
  });
  const validCommentIds = new Set(activeComments.map(c => c.id));

  let orphanMarksCount = 0;
  let missingDeliverablesCount = 0;

  for (const t of recentTickets) {
    const clientName = t.client?.name || 'Desconocido';

    // A. Chequear marcas inline huérfanas en objetivo, notas y copies
    const textsToCheck = [
      { field: 'objetivo', content: t.objetivo || '' },
      { field: 'notasAudiovisual', content: t.notasAudiovisual || '' },
      ...Object.entries((t.contentPerCanal as Record<string, string>) || {}).map(([canal, html]) => ({
        field: `copy_${canal}`,
        content: html || '',
      })),
    ];

    for (const { field, content } of textsToCheck) {
      if (!content || !content.includes('<mark')) continue;

      const markMatches = Array.from(content.matchAll(/<mark[^>]*data-c=["'](c_)?([a-zA-Z0-9_-]+)["'][^>]*>/gi));
      for (const m of markMatches) {
        const commentId = m[2];
        if (!validCommentIds.has(commentId)) {
          orphanMarksCount++;
          issues.push({
            type: 'ORPHAN_INLINE_MARK',
            severity: 'MEDIUM',
            ticketId: t.id,
            ticketTitle: t.title,
            clientName,
            detail: `Marca <mark> huérfana en ${field} para comentario ya eliminado/resuelto (${commentId})`,
            context: { field, commentId },
          });
        }
      }
    }

    // B. Chequear tickets listos/publicados que perdieron linkEntregable
    const advancedStatuses = ['LISTO_PARA_PUBLICAR', 'LISTO', 'PUBLICADO', 'CLIENTE'];
    if (advancedStatuses.includes(t.status)) {
      const hasDeliverableLink = Boolean(t.linkEntregable && t.linkEntregable.trim().length > 0);
      const hasLinks = Array.isArray(t.links) && t.links.length > 0;

      // Si no tiene linkEntregable ni links de recursos de entrega
      if (!hasDeliverableLink && !hasLinks) {
        missingDeliverablesCount++;
        issues.push({
          type: 'MISSING_DELIVERABLE',
          severity: 'HIGH',
          ticketId: t.id,
          ticketTitle: t.title,
          clientName,
          detail: `Ticket en estado "${t.status}" no tiene ningún link cargado en "Entregable final"`,
          context: { status: t.status },
        });
      }
    }

    // C. Chequear si la descripción quedó completamente en blanco
    if (t.tipoTicket === 'TAREA' && (!t.objetivo || t.objetivo.trim().length === 0)) {
      issues.push({
        type: 'EMPTY_DESCRIPTION',
        severity: 'LOW',
        ticketId: t.id,
        ticketTitle: t.title,
        clientName,
        detail: `Tarea actualizada recientemente con campo de descripción/brief en blanco`,
        context: { tipoTicket: t.tipoTicket },
      });
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    auditWindowHours: hours,
    since: since.toISOString(),
    summary: {
      ticketsAudited: recentTickets.length,
      commentsAudited: recentComments.length,
      commentsWithImages: commentsWithImagesCount,
      attachmentsChecked: attachmentsFoundCount,
      orphanMarksFound: orphanMarksCount,
      missingDeliverablesFound: missingDeliverablesCount,
      totalIssues: issues.length,
      healthStatus: issues.filter(i => i.severity === 'HIGH').length === 0 ? 'HEALTHY' : 'ATTENTION_REQUIRED',
    },
    issues,
  };

  return report;
}

// CLI execution
if (process.argv[1]?.endsWith('audit-ticket-integrity.ts')) {
  const args = process.argv.slice(2);
  const hoursArg = args.find(a => a.startsWith('--hours='));
  const hours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 36;
  const jsonMode = args.includes('--json');

  runTicketIntegrityAudit({ hours, json: jsonMode })
    .then(report => {
      if (jsonMode) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`\n======================================================`);
        console.log(`🔍 AUDITORÍA DE INTEGRIDAD DE TICKETS (ÚLTIMAS ${report.auditWindowHours}H)`);
        console.log(`======================================================`);
        console.log(`Período analizado: Desde ${report.since}`);
        console.log(`Estado general: ${report.summary.healthStatus === 'HEALTHY' ? '🟢 SALUDABLE' : '🔴 REQUIERE ATENCIÓN'}`);
        console.log(`- Tickets modificados auditados: ${report.summary.ticketsAudited}`);
        console.log(`- Comentarios auditados: ${report.summary.commentsAudited}`);
        console.log(`- Comentarios con imágenes/fotos: ${report.summary.commentsWithImages}`);
        console.log(`- Adjuntos validados en DB: ${report.summary.attachmentsChecked}`);
        console.log(`- Marcas inline huérfanas: ${report.summary.orphanMarksFound}`);
        console.log(`- Entregables faltantes en LISTO/PUBLICADO: ${report.summary.missingDeliverablesFound}`);
        console.log(`- Total de anomalías detectadas: ${report.summary.totalIssues}\n`);

        if (report.issues.length === 0) {
          console.log(`✅ ¡Cero anomalías detectadas! Todos los casos recientes están íntegros.`);
        } else {
          console.log(`📋 Detalle de casos para revisar:`);
          report.issues.forEach((issue, idx) => {
            const icon = issue.severity === 'HIGH' ? '❌' : issue.severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
            console.log(`  ${idx + 1}. ${icon} [${issue.severity}] [${issue.clientName}] ${issue.ticketTitle}`);
            console.log(`     Detalle: ${issue.detail}`);
            console.log(`     Ticket ID: ${issue.ticketId}`);
          });
        }
        console.log(`======================================================\n`);
      }
    })
    .catch(err => {
      console.error('Error al ejecutar auditoría de tickets:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
