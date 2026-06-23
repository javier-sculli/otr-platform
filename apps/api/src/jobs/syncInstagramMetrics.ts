import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actor: apify/instagram-post-scraper
// Input: { username: string[], resultsLimit: number, onlyPostsNewerThan?: string (YYYY-MM-DD) }
// Output: { shortCode, url, caption, likesCount, commentsCount, timestamp, displayUrl, ownerUsername }
const ACTOR_ID = 'apify~instagram-post-scraper';

interface ApifyInstagramPost {
  shortCode?: string;
  url?: string;
  caption?: string;
  likesCount?: number | null;
  commentsCount?: number;
  timestamp?: string;
  displayUrl?: string;
  ownerUsername?: string;
}

function getDayNumber(publishedAt: Date): number {
  const diffDays = Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays <= 5 ? diffDays : 99;
}

function extractInstagramUsername(url: string): string | null {
  const match = url.match(/instagram\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

export async function syncInstagramMetrics(clientId?: string) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error('[syncInstagram] APIFY_TOKEN no configurado');
    return;
  }

  const apify = new ApifyClient({ token: apifyToken });

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      instagramUrl: { not: null },
      ...(clientId ? { id: clientId } : {}),
    },
  });

  if (clients.length === 0) {
    console.log('[syncInstagram] No hay clientes con instagramUrl configurado');
    return;
  }

  const speakers = await prisma.speaker.findMany({
    where: {
      clientId: { in: clients.map(c => c.id) },
      instagramUrl: { not: null },
    },
    select: { id: true, clientId: true, nombre: true, instagramUrl: true },
  });

  type SyncTarget = { username: string; clientId: string; speakerId: string | null; label: string };
  const targets: SyncTarget[] = [];

  for (const c of clients) {
    const username = extractInstagramUsername(c.instagramUrl!);
    if (username) targets.push({ username, clientId: c.id, speakerId: null, label: c.name });
  }
  for (const s of speakers) {
    const username = extractInstagramUsername(s.instagramUrl!);
    if (username) targets.push({ username, clientId: s.clientId, speakerId: s.id, label: s.nombre });
  }

  if (targets.length === 0) {
    console.log('[syncInstagram] No se pudieron extraer usernames de las URLs configuradas');
    return;
  }

  console.log(`[syncInstagram] Procesando ${targets.length} perfil(es) (${clients.length} clientes, ${speakers.length} voceros)...`);

  for (const target of targets) {
    console.log(`[syncInstagram] → ${target.label} (@${target.username})`);

    try {
      // Buscar el post más reciente que ya tenemos para este perfil
      const lastPub = await prisma.publication.findFirst({
        where: {
          canal: 'Instagram',
          clientId: target.clientId,
          speakerId: target.speakerId ?? undefined,
        },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      });

      let actorInput: Record<string, unknown>;

      if (lastPub) {
        // Sync incremental: solo posts más nuevos que el último que tenemos (con 1 día de buffer)
        const since = new Date(lastPub.publishedAt);
        since.setDate(since.getDate() - 1);
        const sinceStr = since.toISOString().slice(0, 10);
        actorInput = {
          username: [target.username],
          resultsLimit: 150, // backfill: subido de 20 — bajar a 20 tras la corrida de recuperación
          onlyPostsNewerThan: sinceStr,
        };
        console.log(`[syncInstagram]   modo incremental desde ${sinceStr}`);
      } else {
        // Primera vez: traer historial completo
        actorInput = { username: [target.username], resultsLimit: 150 }; // backfill: subido de 50 — bajar a 50 tras la corrida
        console.log(`[syncInstagram]   modo inicial — cargando historial`);
      }

      // URLs existentes para distinguir nuevo vs update
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const existingUrls = new Set(
        (await prisma.publication.findMany({
          where: { canal: 'Instagram', clientId: target.clientId, publishedAt: { gte: cutoff } },
          select: { url: true },
        })).map(p => p.url)
      );

      const run = await apify.actor(ACTOR_ID).call(actorInput);
      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const posts = items as ApifyInstagramPost[];

      console.log(`[syncInstagram]   ${posts.length} posts recibidos`);

      let newCount = 0;
      let updatedCount = 0;

      for (const post of posts) {
        const postUrl = post.url ?? (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);
        if (!postUrl) continue;

        const publishedAt = post.timestamp ? new Date(post.timestamp) : new Date();
        const likes = (post.likesCount != null && post.likesCount >= 0) ? post.likesCount : 0;
        const comments = post.commentsCount ?? 0;
        const imageUrl = post.displayUrl ?? null;
        const isNew = !existingUrls.has(postUrl);

        const publication = await prisma.publication.upsert({
          where: { url: postUrl },
          create: {
            clientId: target.clientId,
            speakerId: target.speakerId,
            url: postUrl,
            publishedAt,
            canal: 'Instagram',
            postContent: post.caption ?? null,
            imageUrl,
          },
          update: {
            ...(target.speakerId ? { speakerId: target.speakerId } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          },
        });

        const dayNumber = getDayNumber(publication.publishedAt);

        if (dayNumber <= 5) {
          const existing = await prisma.postMetricSnapshot.findUnique({
            where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          });
          if (existing) continue;
        }

        // Instagram no expone shares
        await prisma.postMetricSnapshot.upsert({
          where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          create: { publicationId: publication.id, dayNumber, likes, comments, shares: 0 },
          update: { likes, comments, takenAt: new Date() },
        });

        if (isNew) newCount++;
        else updatedCount++;

        console.log(`[syncInstagram]   ${isNew ? '✨ nuevo' : '↻ update'} día ${dayNumber === 99 ? 'final' : dayNumber} — ${likes}❤ ${comments}💬 — ${postUrl.slice(0, 55)}`);
      }

      console.log(`[syncInstagram]   → ${newCount} nuevos, ${updatedCount} actualizados`);
    } catch (err) {
      console.error(`[syncInstagram] Error en ${target.label}:`, err);
    }
  }

  console.log('[syncInstagram] Sync completado');
}
