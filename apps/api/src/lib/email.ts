import { Resend } from 'resend';
import { config } from '../config.js';
import { Sentry } from './sentry.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;
const FROM_EMAIL = config.resendFrom;

export interface NotificationEmailPayload {
  to: string;
  type: 'MENTION' | 'ASSIGNED' | 'STATUS_CHANGE';
  fromName: string;
  ticketId?: string;
  ticketTitle?: string;
  clientName?: string;
  ticketTypeName?: string;
  dueDateFormatted?: string;
  oldStatusLabel?: string;
  newStatusLabel?: string;
  commentContent?: string;
  customMessage?: string;
}

/**
 * Builds the subject line following industry standard format:
 * [ROCKY] [{Tipo/Estado}] · {NombreTicket}
 */
export function buildSubject(payload: NotificationEmailPayload): string {
  const ticketTitle = payload.ticketTitle || 'Ticket';
  switch (payload.type) {
    case 'MENTION':
      return `[ROCKY] [Mención] · ${ticketTitle}`;
    case 'ASSIGNED':
      return `[ROCKY] [Asignación] · ${ticketTitle}`;
    case 'STATUS_CHANGE':
      return `[ROCKY] [Cambio de estado] · ${ticketTitle}`;
    default:
      return `[ROCKY] Notificación · ${ticketTitle}`;
  }
}

/**
 * Generates responsive HTML email matching ROCKY platform aesthetics
 * (Navy #000033 header, Electric Blue #024fff CTAs, clean cards and badges).
 */
export function generateNotificationHtml(payload: NotificationEmailPayload): string {
  const frontendUrl = config.frontendUrl || 'http://localhost:5173';
  const ticketUrl = payload.ticketId ? `${frontendUrl}/piezas/${payload.ticketId}` : frontendUrl;
  const ticketTitle = payload.ticketTitle || 'Ticket de Contenido';
  const clientName = payload.clientName || 'Cliente';

  let badgeColor = '#024fff';
  let badgeBg = '#EEF2FF';
  let badgeBorder = '#C7D2FE';
  let badgeLabel = '@ Mención en Comentario';
  let mainMessageHtml = '';
  let ctaText = 'Ver Ticket';

  if (payload.type === 'MENTION') {
    badgeColor = '#4F46E5';
    badgeBg = '#EEF2FF';
    badgeBorder = '#C7D2FE';
    badgeLabel = '💬 Mención en comentario';
    ctaText = 'Ver comentario';
    mainMessageHtml = `
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
        <strong style="color: #000033;">${payload.fromName}</strong> te mencionó en un comentario sobre el ticket <strong style="color: #024fff;">"${ticketTitle}"</strong>.
      </p>
      ${payload.commentContent ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #024fff; padding: 14px 16px; border-radius: 4px 8px 8px 4px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Comentario</div>
          <div style="font-size: 14px; color: #334155; font-style: italic; line-height: 1.5;">"${escapeHtml(payload.commentContent)}"</div>
        </div>
      ` : ''}
    `;
  } else if (payload.type === 'ASSIGNED') {
    badgeColor = '#047857';
    badgeBg = '#ECFDF5';
    badgeBorder = '#A7F3D0';
    badgeLabel = '👤 Nueva Asignación';
    ctaText = 'Ver Ticket Asignado';
    mainMessageHtml = `
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
        <strong style="color: #000033;">${payload.fromName}</strong> te asignó el ticket <strong style="color: #024fff;">"${ticketTitle}"</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">Cliente</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 700;">${escapeHtml(clientName)}</td>
        </tr>
        ${payload.ticketTypeName ? `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">Formato / Tipo</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;"><span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${escapeHtml(payload.ticketTypeName)}</span></td>
        </tr>` : ''}
        ${payload.dueDateFormatted ? `
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600;">Fecha límite</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #dc2626; font-weight: 700;">📅 ${escapeHtml(payload.dueDateFormatted)}</td>
        </tr>` : ''}
      </table>
    `;
  } else if (payload.type === 'STATUS_CHANGE') {
    badgeColor = '#1D4ED8';
    badgeBg = '#EFF6FF';
    badgeBorder = '#BFDBFE';
    badgeLabel = '🔄 Cambio de Estado';
    ctaText = 'Ver Ticket';
    const oldSt = payload.oldStatusLabel || 'Anterior';
    const newSt = payload.newStatusLabel || 'Nuevo';
    mainMessageHtml = `
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
        <strong style="color: #000033;">${payload.fromName}</strong> actualizó el estado del ticket <strong style="color: #024fff;">"${ticketTitle}"</strong>.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Transición de estado</div>
        <div style="display: inline-block; vertical-align: middle;">
          <span style="background-color: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(oldSt)}</span>
          <span style="color: #94a3b8; font-weight: bold; margin: 0 8px;">➔</span>
          <span style="background-color: #024fff; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700;">${escapeHtml(newSt)}</span>
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(buildSubject(payload))}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #000033; padding: 20px 28px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: 1px;">ROCKY</span>
                    <span style="color: #024fff; font-weight: 900; font-size: 20px;">.</span>
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Sistema de Contenido</span>
                  </td>
                  <td align="right">
                    <span style="background-color: rgba(255,255,255,0.1); color: #cbd5e1; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px;">ON THE ROCKS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Area -->
          <tr>
            <td style="padding: 28px 28px 24px 28px;">
              
              <!-- Badge -->
              <div style="margin-bottom: 16px;">
                <span style="background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block;">
                  ${badgeLabel}
                </span>
              </div>

              <!-- Main message & context -->
              ${mainMessageHtml}

              <!-- Ticket Info Box -->
              <div style="background-color: #fafafa; border: 1px solid #f1f5f9; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ticket de Referencia</div>
                <div style="font-size: 15px; font-weight: 700; color: #000033;">${escapeHtml(ticketTitle)}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Cliente: <strong>${escapeHtml(clientName)}</strong></div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0 12px 0;">
                <a href="${ticketUrl}" target="_blank" style="background-color: #024fff; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 79, 255, 0.25);">
                  ${ctaText} &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Notificación automática enviada desde <strong>ROCKY</strong> · Sistema de Producción de Contenido On The Rocks.
                <br>
                <a href="${frontendUrl}" style="color: #024fff; text-decoration: none;">Ir a la plataforma</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dispatches an email notification via Resend.
 * Non-blocking, handles errors gracefully.
 */
export async function sendNotificationEmail(payload: NotificationEmailPayload): Promise<{ success: boolean; id?: string; error?: any }> {
  if (!resend) {
    console.log(`[EMAIL DISPATCH SKIPPED] Resend API key missing. Email would have been sent to ${payload.to}`);
    return { success: false, error: 'Resend API key missing' };
  }

  const subject = buildSubject(payload);
  const html = generateNotificationHtml(payload);

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: [payload.to],
      subject,
      html,
    });

    if (data.error) {
      console.error(`[EMAIL DISPATCH ERROR] Failed to send email to ${payload.to}:`, data.error);
      Sentry.captureMessage(`Resend email error to ${payload.to}: ${JSON.stringify(data.error)}`, 'error');
      return { success: false, error: data.error };
    }

    console.log(`[EMAIL DISPATCH SUCCESS] Sent email "${subject}" to ${payload.to} (ID: ${data.data?.id})`);
    return { success: true, id: data.data?.id };
  } catch (error) {
    console.error(`[EMAIL DISPATCH EXCEPTION] Failed sending email to ${payload.to}:`, error);
    Sentry.captureException(error);
    return { success: false, error };
  }
}
