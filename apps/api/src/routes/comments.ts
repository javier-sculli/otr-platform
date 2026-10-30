import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendNotificationEmail } from '../lib/email.js';

const NICKNAMES: Record<string, string> = {
  joaco: 'joaquín',
  manu: 'manuela',
  javi: 'javier',
  sofi: 'sofía',
  santi: 'santiago',
  lore: 'lorena',
  nati: 'natalia',
  nahue: 'nahuel',
  palo: 'paloma',
  geo: 'georgina',
  agu: 'agustina',
  guada: 'guadalupe',
  shai: 'shaiel',
};

function normalizeStr(str: string) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function normalizeCommentMedia(rawContent: string): Promise<string> {
  if (!rawContent.includes('data:image/heic') && !rawContent.includes('data:image/heif')) {
    return rawContent;
  }
  let converted = rawContent;
  const heicRegex = /data:image\/(?:heic|heif);base64,([A-Za-z0-9+/=]+)/g;
  let match;
  while ((match = heicRegex.exec(rawContent)) !== null) {
    try {
      const base64Str = match[1];
      const heicBuffer = Buffer.from(base64Str, 'base64');
      const decode = (await import('heic-decode')).default;
      const sharp = (await import('sharp')).default;
      const { width, height, data } = await decode({ buffer: heicBuffer });
      const jpegBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      const newBase64 = 'data:image/jpeg;base64,' + jpegBuffer.toString('base64');
      converted = converted.replace(match[0], newBase64);
    } catch (err) {
      console.warn('Error convirtiendo HEIC a JPEG en backend:', err);
    }
  }
  return converted;
}

async function processUploadedAttachment(
  fileBuffer: Buffer,
  originalFilename: string,
  originalMime: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const isHeic =
    originalFilename.toLowerCase().endsWith('.heic') ||
    originalFilename.toLowerCase().endsWith('.heif') ||
    originalMime.includes('heic') ||
    originalMime.includes('heif');

  if (isHeic) {
    try {
      const decode = (await import('heic-decode')).default;
      const sharp = (await import('sharp')).default;
      const { width, height, data } = await decode({ buffer: fileBuffer });
      const jpegBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();

      const newName = originalFilename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
      return { buffer: jpegBuffer, mimeType: 'image/jpeg', fileName: newName };
    } catch (err) {
      console.warn('Error procesando HEIC en backend, guardando original:', err);
      return { buffer: fileBuffer, mimeType: originalMime, fileName: originalFilename };
    }
  }

  const isRasterImage =
    originalMime.startsWith('image/') &&
    !originalMime.includes('svg') &&
    !originalMime.includes('gif');

  if (isRasterImage) {
    try {
      const sharp = (await import('sharp')).default;
      const jpegBuffer = await sharp(fileBuffer)
        .rotate()
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      const newName = originalFilename.replace(/\.[a-zA-Z0-9]+$/, '.jpg');
      return { buffer: jpegBuffer, mimeType: 'image/jpeg', fileName: newName };
    } catch (err) {
      console.warn('Error optimizando imagen en backend, guardando original:', err);
      return { buffer: fileBuffer, mimeType: originalMime, fileName: originalFilename };
    }
  }

  return { buffer: fileBuffer, mimeType: originalMime, fileName: originalFilename };
}

export async function commentsRoutes(fastify: FastifyInstance) {
  // Public GET for image / file attachments so native <img> and <a> tags load freely
  fastify.get('/attachments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attachment = await prisma.commentAttachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      return reply.status(404).send({ error: 'Archivo no encontrado' });
    }

    return reply
      .header('Content-Type', attachment.mimeType)
      .header('Content-Length', attachment.size)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`)
      .send(attachment.data);
  });

  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.includes('/attachments/')) {
      return;
    }
    await authenticate(request, reply);
  });

  // POST /tickets/:ticketId/attachments (Uploads and processes image/doc attachments)
  fastify.post('/:ticketId/attachments', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket no encontrado' });
    }

    const part = await request.file();
    if (!part) {
      return reply.status(400).send({ error: 'No se envió ningún archivo' });
    }

    const buffer = await part.toBuffer();
    const originalFilename = part.filename || 'archivo';
    const originalMime = part.mimetype || 'application/octet-stream';

    const processed = await processUploadedAttachment(buffer, originalFilename, originalMime);

    const attachment = await prisma.commentAttachment.create({
      data: {
        ticketId,
        fileName: processed.fileName,
        mimeType: processed.mimeType,
        size: processed.buffer.length,
        data: processed.buffer,
      },
    });

    return reply.status(201).send({
      data: {
        id: attachment.id,
        url: `/tickets/attachments/${attachment.id}`,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      },
    });
  });

  // GET /tickets/:ticketId/comments
  fastify.get('/:ticketId/comments', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { data: comments };
  });

  // POST /tickets/:ticketId/comments
  fastify.post('/:ticketId/comments', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const { content: rawContent } = request.body as { content: string };
    const user = (request as any).user;

    if (!rawContent?.trim()) return reply.status(400).send({ error: 'Contenido requerido' });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, title: true, client: { select: { name: true } } }
    });
    if (!ticket) return reply.status(404).send({ error: 'Ticket no encontrado' });

    // Convert any HEIC/HEIF images to standard JPEG before storage
    const content = await normalizeCommentMedia(rawContent);

    // Detectar @menciones en el contenido (solo en texto legible, ignorando URLs de medios y adjuntos)
    let mentionedIds: string[] = [];
    const textOnly = content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[[^\]]*\]\([^)]+\)/g, '');

    if (textOnly.includes('@')) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
      });

      const matchedUserIds = new Set<string>();
      const normContent = normalizeStr(textOnly);

      for (const u of allUsers) {
        if (u.id === user.id) continue; // Ignorar auto-mención

        const nameNorm = normalizeStr(u.name);
        const firstNameNorm = nameNorm.split(' ')[0];
        const emailPrefixNorm = normalizeStr(u.email ? u.email.split('@')[0] : '');

        // Construir candidatos de búsqueda para el usuario (nombre, primer nombre, email, apodos)
        const candidates = new Set<string>();
        if (nameNorm) candidates.add(nameNorm);
        if (firstNameNorm) candidates.add(firstNameNorm);
        if (emailPrefixNorm) candidates.add(emailPrefixNorm);

        for (const [nick, targetName] of Object.entries(NICKNAMES)) {
          const normTarget = normalizeStr(targetName);
          if (nameNorm === normTarget || firstNameNorm === normTarget || nameNorm.includes(normTarget)) {
            candidates.add(nick);
          }
        }

        // Probar los candidatos ordenados por longitud descendente para preferir nombres completos
        const sortedCandidates = Array.from(candidates).sort((a, b) => b.length - a.length);
        for (const cand of sortedCandidates) {
          if (!cand || cand.length < 2) continue;
          const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`@${escaped}(?=[^a-z0-9áéíóúñ]|\\s|$)`, 'i');
          if (regex.test(normContent)) {
            matchedUserIds.add(u.id);
            break;
          }
        }
      }
      mentionedIds = Array.from(matchedUserIds);
    }

    const comment = await prisma.ticketComment.create({
      data: { ticketId, userId: user.id, content, mentions: mentionedIds },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (mentionedIds.length > 0) {
      const senderId = user.id;
      setImmediate(async () => {
        try {
          const senderUser = await prisma.user.findUnique({
            where: { id: senderId },
            select: { name: true, email: true }
          });
          const senderName = senderUser?.name || senderUser?.email || user.email || 'Un usuario';
          const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

          for (const uid of mentionedIds) {
            const recipientUser = await prisma.user.findUnique({
              where: { id: uid },
              select: { email: true }
            });

            const existingNotif = await prisma.notification.findFirst({
              where: {
                userId: uid,
                ticketId,
                type: 'MENTION',
                read: false,
                createdAt: { gte: twoMinAgo }
              }
            });
            if (existingNotif) {
              await prisma.notification.update({
                where: { id: existingNotif.id },
                data: {
                  fromName: senderName,
                  message: `${senderName} te mencionó en "${ticket.title}"`,
                  createdAt: new Date(),
                }
              });
            } else {
              await prisma.notification.create({
                data: {
                  userId: uid,
                  ticketId,
                  commentId: comment.id,
                  type: 'MENTION',
                  fromName: senderName,
                  message: `${senderName} te mencionó en "${ticket.title}"`,
                }
              });
            }

            if (recipientUser?.email) {
              const cleanEmailContent = content
                .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Imagen adjunta]')
                .replace(/\[(?:📎\s*|archivo:\s*)?([^\]]+)\]\([^)]+\)/gi, '[Archivo: $1]')
                .trim();

              sendNotificationEmail({
                to: recipientUser.email,
                type: 'MENTION',
                fromName: senderName,
                ticketId: ticket.id,
                ticketTitle: ticket.title,
                clientName: ticket.client?.name || 'Cliente',
                commentContent: cleanEmailContent,
              }).catch(() => {});
            }
          }
        } catch (e) {
          // ignore background errors
        }
      });
    }

    return reply.status(201).send({ data: comment });
  });

  // DELETE /tickets/:ticketId/comments/:commentId
  fastify.delete('/:ticketId/comments/:commentId', async (request, reply) => {
    const { ticketId, commentId } = request.params as { ticketId: string; commentId: string };
    const user = (request as any).user;

    const comment = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.status(404).send({ error: 'Comentario no encontrado' });
    if (comment.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sin permiso' });
    }

    await prisma.ticketComment.delete({ where: { id: commentId } });

    // Clean up mark in ticket html fields
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, objetivo: true, notasAudiovisual: true, contentPerCanal: true }
      });
      if (ticket) {
        const markRegex = new RegExp(`<mark[^>]*data-c=["'](c_)?${commentId}["'][^>]*>([\\s\\S]*?)</mark>`, 'gi');
        let updateNeeded = false;
        const updateData: any = {};

        if (ticket.objetivo && markRegex.test(ticket.objetivo)) {
          updateData.objetivo = ticket.objetivo.replace(markRegex, '$2');
          updateNeeded = true;
        }
        if (ticket.notasAudiovisual && markRegex.test(ticket.notasAudiovisual)) {
          updateData.notasAudiovisual = ticket.notasAudiovisual.replace(markRegex, '$2');
          updateNeeded = true;
        }
        if (ticket.contentPerCanal && typeof ticket.contentPerCanal === 'object') {
          const perCanal = { ...(ticket.contentPerCanal as Record<string, string>) };
          let canalChanged = false;
          for (const [ch, val] of Object.entries(perCanal)) {
            if (typeof val === 'string' && markRegex.test(val)) {
              perCanal[ch] = val.replace(markRegex, '$2');
              canalChanged = true;
            }
          }
          if (canalChanged) {
            updateData.contentPerCanal = perCanal;
            updateNeeded = true;
          }
        }

        if (updateNeeded) {
          await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData,
          });
        }
      }
    } catch (e) {
      fastify.log.error(e, 'Error cleaning up ticket mark on comment delete');
    }

    return reply.status(204).send();
  });
}
