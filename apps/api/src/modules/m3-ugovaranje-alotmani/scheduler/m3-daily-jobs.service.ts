import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CapacityService } from '../capacity/capacity.service';
import { OfferExpiryService } from '../pricelist/offer-expiry.service';

/**
 * Jedan dnevni posao za sve M3 provere „šta ističe" — isti obrazac kao M5 `RemindersService`.
 *
 * Do 17.9.2026 `CapacityService.releaseExpiredBlocks` (§2.8b, samovraćanje blokada po
 * `hold_until`) NIJE imao nijednog pozivaoca — metoda je postojala i bila testirana, a raspored
 * koji je zove nikad nije napisan, pa se nijedna blokada nikad nije sama vratila u prodaju
 * (zamka 8.16). Uočeno kad je §4.9 trebalo da se „nadoveže na isti obrazac".
 */
@Injectable()
export class M3DailyJobsService {
  private readonly logger = new Logger(M3DailyJobsService.name);

  constructor(
    private readonly capacity: CapacityService,
    private readonly offerExpiry: OfferExpiryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDaily(): Promise<void> {
    try {
      const blocks = await this.capacity.releaseExpiredBlocks();
      this.logger.log(
        `Blokade: ${blocks.released} vraćeno u prodaju, ${blocks.expiring} ističe u naredna 2 dana.`,
      );
    } catch (err) {
      this.logger.error(`Samovraćanje blokada nije uspelo: ${(err as Error).message}`);
    }
    try {
      await this.offerExpiry.runDaily();
    } catch (err) {
      this.logger.error(`Akcije pred istek nisu proverene: ${(err as Error).message}`);
    }
  }
}
