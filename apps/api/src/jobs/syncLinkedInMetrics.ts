import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actor: harvestapi/linkedin-profile-posts (ID: A3cAPGpwBEG8RJwse)
const ACTOR_ID = 'A3cAPGpwBEG8RJwse';

interface ApifyPost {
  linkedinUrl?: string;
  content?: string;
  postedAt?: { date?: string; timestamp?: number };
  postImages?: { url?: string }[];
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

function getDayNumber(publishedAt: Date): number {
  const diffDays = Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays <= 5 ? diffDays : 99; // 99 = foto final, se pisa siempre
}

export async function syncLinkedInMetrics(clientId?: string) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error('[syncLinkedIn] APIFY_TOKEN no configurado');
    return;
  }

  const apify = new ApifyClient({ token: apifyToken });

  // Traer clientes con linkedinUrl configurado
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      linkedinUrl: { not: null },
      ...(clientId ? { id: clientId } : {}),
    },
  });

  if (clients.length === 0) {
    console.log('[syncLinkedIn] No hay clientes con linkedinUrl configurado');
    return;
  }

  console.log(`[syncLinkedIn] Procesando ${clients.length} cliente(s)...`);

  for (const client of clients) {
    console.log(`[syncLinkedIn] → ${client.name} (${client.linkedinUrl})`);

    try {
      const run = await apify.actor(ACTOR_ID).call({
        targetUrls: [client.linkedinUrl],
        maxPosts: 50,
        postedLimit: 'month', // solo posts del último mes
        includeQuotePosts: false,
        includeReposts: false,
        scrapeReactions: false,
        scrapeComments: false,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const posts = items as ApifyPost[];

      console.log(`[syncLinkedIn]   ${posts.length} posts encontrados`);

      for (const post of posts) {
        if (!post.linkedinUrl) continue;

        const publishedAt = post.postedAt?.date
          ? new Date(post.postedAt.date)
          : post.postedAt?.timestamp
          ? new Date(post.postedAt.timestamp * 1000)
          : new Date();

        const likes = post.engagement?.likes ?? 0;
        const comments = post.engagement?.comments ?? 0;
        const shares = post.engagement?.shares ?? 0;
        const imageUrl = post.postImages?.[0]?.url ?? null;

        // Upsert publication por URL (evita duplicados)
        const publication = await prisma.publication.upsert({
          where: { url: post.linkedinUrl },
          create: {
            clientId: client.id,
            url: post.linkedinUrl,
            publishedAt,
            canal: 'LinkedIn',
            postContent: post.content ?? null,
            imageUrl,
          },
          update: {
            // Solo actualiza imagen si no la teníamos
            ...(imageUrl ? { imageUrl } : {}),
          },
        });

        const dayNumber = getDayNumber(publication.publishedAt);

        // Días 1-5: no pisar si ya existe
        if (dayNumber <= 5) {
          const existing = await prisma.postMetricSnapshot.findUnique({
            where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          });
          if (existing) continue;
        }

        await prisma.postMetricSnapshot.upsert({
          where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          create: { publicationId: publication.id, dayNumber, likes, comments, shares },
          update: { likes, comments, shares, takenAt: new Date() },
        });

        console.log(`[syncLinkedIn]   ✓ día ${dayNumber === 99 ? 'final' : dayNumber} — ${likes}❤ ${comments}💬 ${shares}🔁 — ${post.linkedinUrl.slice(0, 60)}...`);
      }
    } catch (err) {
      console.error(`[syncLinkedIn] Error en cliente ${client.name}:`, err);
    }
  }

  console.log('[syncLinkedIn] Sync completado');
}
