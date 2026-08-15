import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// M18 spec §3 — TELEGRAM kanal. Bez nove zavisnosti (Telegram Bot API je čist HTTP, koristi se
// globalni `fetch`, dostupan u Node 18+ bez dodatne biblioteke — isti princip kao odluka da se
// ne uvodi nova zavisnost bez potrebe, CLAUDE.md). Isti "graceful degradacija" obrazac kao
// AnthropicClientService (M15) — ako TELEGRAM_BOT_TOKEN nije podešen, ne baca grešku, samo loguje.
@Injectable()
export class TelegramClientService {
  private readonly logger = new Logger(TelegramClientService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  async send(chatId: string, text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN nije podešen — Telegram obaveštenje nije poslato (samo logovano).');
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!res.ok) {
        this.logger.error(`Telegram API je vratio ${res.status} pri slanju ka chat_id=${chatId}.`);
      }
    } catch (err) {
      this.logger.error(`Slanje Telegram obaveštenja nije uspelo: ${(err as Error).message}`);
    }
  }
}
