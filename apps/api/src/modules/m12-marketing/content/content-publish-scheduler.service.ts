import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentService } from './content.service';

/**
 * M12 spec §3, korak 5 — "U zakazano vreme (scheduled_publish_at), sistem automatski objavljuje
 * odobreni sadržaj ... ovo nije nova AI odluka (odluka je već doneta u koraku 4), već mehaničko
 * izvršenje već odobrene radnje, isti princip kao automatski pozivi ka M4/M11." Svaki minut je
 * dovoljno često za marketinški sadržaj (za razliku od noćnih M13/M10 poslova) da "zakazano vreme"
 * zaista deluje kao zakazano, a dovoljno retko da ne optereti bazu.
 */
@Injectable()
export class ContentPublishSchedulerService {
  private readonly logger = new Logger(ContentPublishSchedulerService.name);

  constructor(private readonly content: ContentService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledPublish(): Promise<void> {
    const count = await this.content.publishDueContent();
    if (count > 0) {
      this.logger.log(`Zakazana objava: ${count} ContentPiece zapis(a) automatski objavljeno.`);
    }
  }
}
