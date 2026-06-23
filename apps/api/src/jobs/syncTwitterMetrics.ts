import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actor: danek/twitter-scraper-ppr (ID: ghSpYIW3L1RvT57NT)
// Input: { username: string, max_posts: number }
// Output: { tweet_id, text, created_at, favorites, replies, retweets, views, author.screen_name, media }
const ACTOR_ID = 'ghSpYIW3L1RvT57NT';

interface ApifyTweet {
  tweet_id?: string;
  text?: string;
  created_at?: string;   // formato Twitter: "Wed May 27 13:35:37 +0000 2026"
  favorites?: number;
  replies?: number;
  retweets?: number;
  views?: string | number;
  bookmarks?: number;
  quotes?: number;
  author?: { screen_name?: string };
  media?: { photo?: { media_url_https?: string }[] };
}

function getDayNumber(publishedAt: Date): number {
  const diffDays = Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays <= 5 ? diffDays : 99;
}

function extractTwitterHandle(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

export async function syncTwitterMetrics(clientId?: string) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error('[syncTwitter] APIFY_TOKEN no configurado');
    return;
  }

  const apify = new ApifyClient({ token: apifyToken });

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      twitterUrl: { not: null },
      ...(clientId ? { id: clientId } : {}),
    },
  });

  if (clients.length === 0) {
    console.log('[syncTwitter] No hay clientes con twitterUrl configurado');
    return;
  }

  const speakers = await prisma.speaker.findMany({
    where: {
      clientId: { in: clients.map(c => c.id) },
      twitterUrl: { not: null },
    },
    select: { id: true, clientId: true, nombre: true, twitterUrl: true },
  });

  type SyncTarget = { handle: string; clientId: string; speakerId: string | null; label: string };
  const targets: SyncTarget[] = [];

  for (const c of clients) {
    const handle = extractTwitterHandle(c.twitterUrl!);
    if (handle) targets.push({ handle, clientId: c.id, speakerId: null, label: c.name });
  }
  for (const s of speakers) {
    const handle = extractTwitterHandle(s.twitterUrl!);
    if (handle) targets.push({ handle, clientId: s.clientId, speakerId: s.id, label: s.nombre });
  }

  if (targets.length === 0) {
    console.log('[syncTwitter] No se pudieron extraer handles de las URLs configuradas');
    return;
  }

  console.log(`[syncTwitter] Procesando ${targets.length} perfil(es) (${clients.length} clientes, ${speakers.length} voceros)...`);

  for (const target of targets) {
    console.log(`[syncTwitter] → ${target.label} (@${target.handle})`);

    try {
      // Buscar el tweet más reciente que ya tenemos para este perfil
      const lastPub = await prisma.publication.findFirst({
        where: {
          canal: 'Twitter',
          clientId: target.clientId,
          speakerId: target.speakerId ?? undefined,
        },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      });

      // Construir el input del actor según si es la primera vez o no
      let actorInput: Record<string, unknown>;

      if (lastPub) {
        // Syncs siguientes: buscar solo tweets nuevos desde el día anterior al último
        // (un día de buffer por si alguno llegó tarde o hay diferencia de timezone)
        const since = new Date(lastPub.publishedAt);
        since.setDate(since.getDate() - 1);
        const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD
        actorInput = {
          query: `from:${target.handle} since:${sinceStr}`,
          search_type: 'Latest',
          max_posts: 150, // backfill: subido de 20 — bajar a 20 tras la corrida de recuperación
        };
        console.log(`[syncTwitter]   modo incremental desde ${sinceStr}`);
      } else {
        // Primera vez: traer historial completo
        actorInput = { username: target.handle, max_posts: 150 }; // backfill: subido de 50 — bajar a 50 tras la corrida
        console.log(`[syncTwitter]   modo inicial — cargando historial`);
      }

      // Cargar URLs existentes de los últimos 90 días (para distinguir nuevo vs update)
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const existingUrls = new Set(
        (await prisma.publication.findMany({
          where: { canal: 'Twitter', clientId: target.clientId, publishedAt: { gte: cutoff } },
          select: { url: true },
        })).map(p => p.url)
      );

      const run = await apify.actor(ACTOR_ID).call(actorInput);

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const tweets = items as ApifyTweet[];

      console.log(`[syncTwitter]   ${tweets.length} tweets recibidos`);

      let newCount = 0;
      let updatedCount = 0;

      for (const tweet of tweets) {
        if (!tweet.tweet_id) continue;
        if (tweet.text?.startsWith('RT @')) continue; // ignorar retweets

        const screenName = tweet.author?.screen_name ?? target.handle;
        const tweetUrl = `https://twitter.com/${screenName}/status/${tweet.tweet_id}`;
        const publishedAt = tweet.created_at ? new Date(tweet.created_at) : new Date();
        const likes = tweet.favorites ?? 0;
        const comments = tweet.replies ?? 0;
        const shares = tweet.retweets ?? 0;
        const views = tweet.views != null ? Number(tweet.views) : null;
        const bookmarks = tweet.bookmarks ?? null;
        const quotes = tweet.quotes ?? null;
        const imageUrl = tweet.media?.photo?.[0]?.media_url_https ?? null;

        const isNew = !existingUrls.has(tweetUrl);

        const publication = await prisma.publication.upsert({
          where: { url: tweetUrl },
          create: {
            clientId: target.clientId,
            speakerId: target.speakerId,
            url: tweetUrl,
            publishedAt,
            canal: 'Twitter',
            postContent: tweet.text ?? null,
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
          if (existing) {
            // Snapshot ya existe — solo actualizar views/bookmarks/quotes si faltan
            if (existing.views === null) {
              await prisma.postMetricSnapshot.update({
                where: { id: existing.id },
                data: { views, bookmarks, quotes },
              });
              updatedCount++;
            }
            continue;
          }
        }

        await prisma.postMetricSnapshot.upsert({
          where: { publicationId_dayNumber: { publicationId: publication.id, dayNumber } },
          create: { publicationId: publication.id, dayNumber, likes, comments, shares, views, bookmarks, quotes },
          update: { likes, comments, shares, views, bookmarks, quotes, takenAt: new Date() },
        });

        if (isNew) newCount++;
        else updatedCount++;

        console.log(`[syncTwitter]   ${isNew ? '✨ nuevo' : '↻ update'} día ${dayNumber === 99 ? 'final' : dayNumber} — ${likes}❤ ${comments}💬 ${shares}🔁${views != null ? ' '+views+'👁' : ''} — ${tweetUrl.slice(0, 55)}`);
      }

      console.log(`[syncTwitter]   → ${newCount} nuevos, ${updatedCount} actualizados`);
    } catch (err) {
      console.error(`[syncTwitter] Error en ${target.label}:`, err);
    }
  }

  console.log('[syncTwitter] Sync completado');
}
