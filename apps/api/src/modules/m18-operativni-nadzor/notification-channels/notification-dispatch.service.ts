import { Injectable, Logger } from '@nestjs/common';
import { HealthSignal } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptSecret } from '../../../common/crypto/secret-box';
import { TelegramClientService } from './telegram-client.service';
import { EmailClientService } from './email-client.service';

// M18 spec §2.2/§3/§4.1 — jedno mesto koje zna kako da isporuči tekst preko svih ACTIVE
// kanala. Koristi ga HealthSignalsService (pojedinačan signal) i WeeklyReviewsService (nedeljni
// sažetak) — obe grane prolaze kroz isti dispečer, ne dupliraju "iteriraj kanale" logiku.
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramClientService,
    private readonly email: EmailClientService,
  ) {}

  async dispatch(signal: Pick<HealthSignal, 'id' | 'sourceModule' | 'signalType' | 'severity' | 'details'>): Promise<HealthSignal> {
    const text = `[${signal.severity}] ${signal.sourceModule} — ${signal.signalType}\n${JSON.stringify(signal.details)}`;
    await this.dispatchText(text);
    return this.prisma.healthSignal.update({ where: { id: signal.id }, data: { notifiedAt: new Date() } });
  }

  async dispatchText(text: string): Promise<void> {
    const channels = await this.prisma.notificationChannel.findMany({ where: { status: 'ACTIVE' } });
    for (const channel of channels) {
      const config = JSON.parse(decryptSecret(channel.configEncrypted)) as Record<string, unknown>;
      if (channel.channelType === 'TELEGRAM') {
        await this.telegram.send(String(config.chatId ?? ''), text);
      } else if (channel.channelType === 'EMAIL') {
        await this.email.send(String(config.email ?? ''), 'Terminal Travel — operativno obaveštenje', text);
      } else {
        // IN_APP — čeka M19 (spec §3 napomena); čist stub dok taj kanal ne postoji.
        this.logger.warn(`IN_APP kanal ${channel.id} je ACTIVE, ali isporuka čeka M19 — poruka nije isporučena.`);
      }
    }
  }
}
