import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBusService } from '../../../common/events/event-bus.service';
import { ExchangeRatesService } from './exchange-rates.service';

// M10 spec §11 — dnevni automatski uvoz NBS kursa. NBS objavljuje kursnu listu radnim danima
// ujutru; 08:30 ostavlja rezervu. Vikendom/praznikom stranica i dalje vraća poslednji objavljeni
// dan (NBS konvencija — petak važi i za vikend), pa poziv tog dana samo tiho ne uvozi ništa novo
// (unique constraint), bez greške — findForCurrencyOnOrBefore već ispravno uzima poslednji kurs.
@Injectable()
export class NbsRateImportCron {
  private readonly logger = new Logger(NbsRateImportCron.name);

  constructor(
    private readonly exchangeRates: ExchangeRatesService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron('30 8 * * *')
  async runDailyImport(): Promise<void> {
    try {
      await this.exchangeRates.importFromNbs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`NBS dnevni uvoz kursa nije uspeo: ${message}`);
      // Čisto informativno (M18 još ne postoji kao model — isti obrazac kao M10AlarmsService).
      // Ne baca dalje: sledećeg dana cron opet pokušava, findForCurrencyOnOrBefore i dalje radi
      // sa poslednjim uspešno uvezenim kursom dok se problem ne reši.
      await this.eventBus.emit('M10', 'exchange_rate_import_failed', { message });
    }
  }
}
