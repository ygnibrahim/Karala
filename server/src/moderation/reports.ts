// Oyuncu bildirimlerinin kaydı. Bildirimler sunucu kaydına (Render → Logs) yazılır;
// REPORT_WEBHOOK_URL tanımlıysa ayrıca oraya gönderilir (ör. Discord kanalı → telefona bildirim).
// Gizli oturum anahtarı ve IP adresi gibi bilgiler asla eklenmez.
import type { ReportReason } from '@shared';
import { MODERATION } from '../config';

export interface ReportRecord {
  room: string;
  reason: ReportReason;
  target: { id: string; name: string };
  reporter: { id: string; name: string };
  /** Bildirilen oyuncunun son mesajları (bağlam için). */
  recentMessages: string[];
  /** Bu oyuncuyu bu odada bildiren farklı kişi sayısı. */
  reportCount: number;
  autoKicked: boolean;
}

const REASON_TEXT: Record<ReportReason, string> = {
  abuse: 'Küfür / hakaret',
  drawing: 'Uygunsuz çizim',
  spam: 'Spam / rahatsız etme',
  other: 'Diğer',
};

const WEBHOOK_TIMEOUT_MS = 5_000;

export type ReportSink = (record: ReportRecord) => void;

/** Varsayılan kayıt: sunucu günlüğüne tek satır JSON + (varsa) webhook. Testlerde değiştirilebilir. */
export const defaultReportSink: ReportSink = (record) => {
  console.warn(JSON.stringify({ type: 'player-report', at: new Date().toISOString(), ...record }));
  const url = MODERATION.reportWebhookUrl;
  if (!url) return;
  const content = [
    `🚩 **${REASON_TEXT[record.reason]}** · oda ${record.room}`,
    `Bildirilen: ${record.target.name} · bildiren: ${record.reporter.name} · toplam ${record.reportCount} bildirim${record.autoKicked ? ' · **otomatik çıkarıldı**' : ''}`,
    record.recentMessages.length ? `Son mesajları:\n> ${record.recentMessages.join('\n> ')}` : 'Son mesajı yok.',
  ].join('\n');
  // Discord "content", Slack "text" alanını okur; ikisi de gönderilir. Hata oyunu etkilemez.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 1900), text: content.slice(0, 1900) }),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  }).catch((err: unknown) => console.error('Bildirim webhook hatası:', (err as Error).message));
};
