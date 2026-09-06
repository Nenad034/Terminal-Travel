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

  /**
   * Koliko dana unazad dnevni posao sam popunjava (M10 spec §3.1a).
   *
   * Zašto uopšte: do 6.9.2026. ovaj cron je povlačio ISKLJUČIVO današnji kurs, pa je svaki dan
   * kad nije prošao (server ugašen, NBS nedostupan, greška pri parsiranju) ostajao TRAJNO bez
   * kursa — ništa ga nikad nije pokušavalo ponovo. Sada se kratak prekid rada zatvara sam.
   *
   * Zašto baš 30: dovoljno da pokrije realan prekid (godišnji odmor, preseljenje servera), a
   * dovoljno kratko da jutarnji posao ostane jeftin — kad nema rupa, sve se svede na JEDAN
   * upit u bazu i nijedan poziv ka NBS-u. Dublja istorija je jednokratan posao i ide skriptom
   * (`npm run rates:backfill`), ne ovim cron-om.
   */
  private static readonly SAMOLECENJE_DANA = 30;

  @Cron('30 8 * * *')
  async runDailyImport(): Promise<void> {
    try {
      await this.exchangeRates.importFromNbs();
      await this.popuniSkorasnjeRupe();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`NBS dnevni uvoz kursa nije uspeo: ${message}`);
      // Čisto informativno (M18 još ne postoji kao model — isti obrazac kao M10AlarmsService).
      // Ne baca dalje: sledećeg dana cron opet pokušava, findForCurrencyOnOrBefore i dalje radi
      // sa poslednjim uspešno uvezenim kursom dok se problem ne reši.
      await this.eventBus.emit('M10', 'exchange_rate_import_failed', { message });
    }
  }

  /**
   * Popunjava dane bez kursa u poslednjih `SAMOLECENJE_DANA`. Odvojeno od `importFromNbs()`
   * iznad namerno: današnji kurs je ono zbog čega posao postoji i njegov neuspeh je vredan
   * signala, dok je popunjavanje rupa unazad higijena — neuspeh se loguje i ćuti, jer bi inače
   * jedan star nedostupan dan svako jutro dizao uzbunu za problem koji niko ne rešava.
   */
  private async popuniSkorasnjeRupe(): Promise<void> {
    const danas = new Date();
    const do_ = new Date(Date.UTC(danas.getUTCFullYear(), danas.getUTCMonth(), danas.getUTCDate()));
    const od = new Date(do_.getTime() - NbsRateImportCron.SAMOLECENJE_DANA * 24 * 60 * 60 * 1000);
    try {
      const r = await this.exchangeRates.backfillMissingRates(od, do_);
      if (r.popunjeno > 0 || r.neuspelo > 0) {
        this.logger.log(`Samolečenje kursne liste: popunjeno ${r.popunjeno}, neuspelo ${r.neuspelo}.`);
      }
    } catch (err) {
      this.logger.warn(`Samolečenje kursne liste nije uspelo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
