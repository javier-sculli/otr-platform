import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actor: apify/instagram-post-scraper
// Input docs: https://apify.com/apify/instagram-post-scraper
const ACTOR_ID = 'apify/instagram-post-scraper';

interface ApifyInstagramPost {
  shortCode?: string;
  url?: string;
  caption?: string;
  likesCount?: number | null;
  commentsCount?: number;
  timestamp?: string;
  displayUrl?: string;
  ownerUsername?: string;
  videoViewCount?: number;
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

  type SyncTarget = { username: string; profileUrl: string; clientId: string; speakerId: string | null; label: string };
  const targets: SyncTarget[] = [];

  for (const c of clients) {
    const username = extractInstagramUsername(c.instagramUrl!);
    if (username) targets.push({ username, profileUrl: c.instagramUrl!, clientId: c.id, speakerId: null, label: c.name });
  }
  for (const s of speakers) {
    const username = extractInstagramUsername(s.instagramUrl!);
    if (username) targets.push({ username, profileUrl: s.instagramUrl!, clientId: s.clientId, speakerId: s.id, label: s.nombre });
  }

  if (targets.length === 0) {
    console.log('[syncInstagram] No se pudieron extraer usernames de las URLs configuradas');
    return;
  }

  console.log(`[syncInstagram] Procesando ${targets.length} perfil(es) (${clients.length} clientes, ${speakers.length} voceros)...`);

  for (const target of targets) {
    console.log(`[syncInstagram] → ${target.label} (@${target.username})`);

    try {
      const run = await apify.actor(ACTOR_ID).call({
        directUrls: [target.profileUrl.endsWith('/') ? target.profileUrl : `${target.profileUrl}/`],
        resultsType: 'posts',
        resultsLimit: 50,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const posts = items as ApifyInstagramPost[];

      console.log(`[syncInstagram]   ${posts.length} posts encontrados`);

      for (const post of posts) {
        const postUrl = post.url ?? (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);
        if (!postUrl) continue;

        const publishedAt = post.timestamp ? new Date(post.timestamp) : new Date();
        const likes = post.likesCount ?? 0;
        const comments = post.commentsCount ?? 0;
        const imageUrl = post.displayUrl ?? null;

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

        await prisma.postMetricSnapshot.upsert({
          where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          create: { publicationId: publication.id, dayNumber, likes, comments, shares: 0 },
          update: { likes, comments, shares: 0, takenAt: new Date() },
        });

        console.log(`[syncInstagram]   ✓ día ${dayNumber === 99 ? 'final' : dayNumber} — ${likes}❤ ${comments}💬 — ${postUrl.slice(0, 60)}`);
      }
    } catch (err) {
      console.error(`[syncInstagram] Error en ${target.label}:`, err);
    }
  }

  console.log('[syncInstagram] Sync completado');
}
