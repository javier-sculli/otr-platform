import cron from 'node-cron';
import { syncLinkedInMetrics } from './syncLinkedInMetrics.js';

export function startCronJobs() {
  // Corre todos los días a las 8am (hora Argentina, UTC-3 → 11:00 UTC)
  cron.schedule('0 11 * * *', async () => {
    console.log('[cron] Iniciando sync de métricas LinkedIn...');
    try {
      await syncLinkedInMetrics();
    } catch (err) {
      console.error('[cron] Error en syncLinkedInMetrics:', err);
    }
  });

  console.log('[cron] Jobs registrados — LinkedIn sync: 8:00 AM ARG diario');
}
