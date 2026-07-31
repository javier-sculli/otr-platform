import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actor: harvestapi/linkedin-profile-posts (ID: A3cAPGpwBEG8RJwse)
const ACTOR_ID = 'A3cAPGpwBEG8RJwse';

interface ApifyPost {
  linkedinUrl?: string;
  url?: string;
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

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim();
  if (!cleaned) return null;
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  try {
    const parsed = new URL(cleaned);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

export async function syncLinkedInMetrics(clientId?: string) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error('[syncLinkedIn] APIFY_TOKEN no configurado');
    return;
  }

  const apify = new ApifyClient({ token: apifyToken });

  // 1. Obtener clientes activos (filtrados por clientId si fue provisto)
  const activeClients = await prisma.client.findMany({
    where: {
      active: true,
      ...(clientId ? { id: clientId } : {}),
    },
    select: { id: true, name: true, linkedinUrl: true },
  });

  if (activeClients.length === 0) {
    console.log('[syncLinkedIn] No se encontraron clientes activos' + (clientId ? ` para id: ${clientId}` : ''));
    return;
  }

  const clientIds = activeClients.map(c => c.id);

  // 2. Obtener voceros de dichos clientes que tengan linkedinUrl configurado
  const speakers = await prisma.speaker.findMany({
    where: {
      clientId: { in: clientIds },
      linkedinUrl: { not: null },
    },
    select: { id: true, clientId: true, nombre: true, linkedinUrl: true },
  });

  // 3. Armar lista de objetivos (targets): URLs del cliente + URLs de voceros
  type SyncTarget = { url: string; clientId: string; speakerId: string | null; label: string };
  const targets: SyncTarget[] = [];

  for (const c of activeClients) {
    const url = normalizeUrl(c.linkedinUrl);
    if (url) {
      targets.push({ url, clientId: c.id, speakerId: null, label: c.name });
    }
  }

  for (const s of speakers) {
    const url = normalizeUrl(s.linkedinUrl);
    if (url) {
      targets.push({ url, clientId: s.clientId, speakerId: s.id, label: s.nombre });
    }
  }

  if (targets.length === 0) {
    console.log('[syncLinkedIn] No hay URLs de LinkedIn configuradas para los clientes/voceros seleccionados');
    return;
  }

  console.log(`[syncLinkedIn] Procesando ${targets.length} perfil(es) (${activeClients.length} clientes, ${speakers.length} voceros)...`);

  for (const target of targets) {
    console.log(`[syncLinkedIn] → ${target.label} (${target.url})`);

    try {
      const run = await apify.actor(ACTOR_ID).call({
        targetUrls: [target.url],
        maxPosts: 50,
        includeQuotePosts: false,
        includeReposts: false,
        scrapeReactions: false,
        scrapeComments: false,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const posts = items as ApifyPost[];

      console.log(`[syncLinkedIn]   ${posts.length} posts encontrados`);

      for (const post of posts) {
        const postUrl = post.linkedinUrl ?? post.url;
        if (!postUrl) continue;

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
          where: { url: postUrl },
          create: {
            clientId: target.clientId,
            speakerId: target.speakerId,
            url: postUrl,
            publishedAt,
            canal: 'LinkedIn',
            postContent: post.content ?? null,
            imageUrl,
          },
          update: {
            // Asigna speaker si aún no tenía uno
            ...(target.speakerId ? { speakerId: target.speakerId } : {}),
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

        console.log(`[syncLinkedIn]   ✓ día ${dayNumber === 99 ? 'final' : dayNumber} — ${likes}❤ ${comments}💬 ${shares}🔁 — ${postUrl.slice(0, 60)}...`);
      }
    } catch (err) {
      console.error(`[syncLinkedIn] Error en ${target.label}:`, err);
    }
  }

  console.log('[syncLinkedIn] Sync completado');
}
