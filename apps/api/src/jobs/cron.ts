import cron from 'node-cron';
import { syncLinkedInMetrics } from './syncLinkedInMetrics.js';
import { syncInstagramMetrics } from './syncInstagramMetrics.js';
import { syncTwitterMetrics } from './syncTwitterMetrics.js';

export function startCronJobs() {
  // Corre todos los días a las 8am (hora Argentina, UTC-3 → 11:00 UTC)
  cron.schedule('0 11 * * *', async () => {
    console.log('[cron] Iniciando sync de métricas...');
    try { await syncLinkedInMetrics(); } catch (err) { console.error('[cron] Error en syncLinkedInMetrics:', err); }
    try { await syncInstagramMetrics(); } catch (err) { console.error('[cron] Error en syncInstagramMetrics:', err); }
    try { await syncTwitterMetrics(); } catch (err) { console.error('[cron] Error en syncTwitterMetrics:', err); }
    console.log('[cron] Sync completado');
  });

  console.log('[cron] Jobs registrados — LinkedIn + Instagram + Twitter sync: 8:00 AM ARG diario');
}
