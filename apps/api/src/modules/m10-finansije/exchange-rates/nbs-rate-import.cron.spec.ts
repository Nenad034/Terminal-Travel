import { NbsRateImportCron } from './nbs-rate-import.cron';

describe('NbsRateImportCron (M10 spec §11)', () => {
  function makeCron() {
    const exchangeRates: any = {
      importFromNbs: jest.fn(),
      backfillMissingRates: jest.fn().mockResolvedValue({ popunjeno: 0, preskoceno: 0, neuspelo: 0 }),
    };
    const eventBus: any = { emit: jest.fn() };
    const cron = new NbsRateImportCron(exchangeRates, eventBus);
    return { cron, exchangeRates, eventBus };
  }

  it('poziva importFromNbs i ne emituje signal kad uspe', async () => {
    const { cron, exchangeRates, eventBus } = makeCron();
    exchangeRates.importFromNbs.mockResolvedValue({ imported: ['EUR', 'USD'], skipped: [] });

    await cron.runDailyImport();

    expect(exchangeRates.importFromNbs).toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  // Samolečenje (6.9.2026, M10 spec §3.1a) — do tada je cron povlačio ISKLJUČIVO današnji
  // kurs, pa je svaki dan kad nije prošao ostajao trajno bez kursa.
  it('posle današnjeg kursa popunjava i rupe iz poslednjih 30 dana', async () => {
    const { cron, exchangeRates } = makeCron();
    exchangeRates.importFromNbs.mockResolvedValue({ imported: ['EUR'], skipped: [] });

    await cron.runDailyImport();

    expect(exchangeRates.backfillMissingRates).toHaveBeenCalledTimes(1);
    const [od, do_] = exchangeRates.backfillMissingRates.mock.calls[0];
    const razmakDana = Math.round((do_.getTime() - od.getTime()) / (24 * 60 * 60 * 1000));
    expect(razmakDana).toBe(30);
  });

  it('neuspelo popunjavanje rupa ne ruši dnevni posao niti diže uzbunu', async () => {
    const { cron, exchangeRates, eventBus } = makeCron();
    exchangeRates.importFromNbs.mockResolvedValue({ imported: ['EUR'], skipped: [] });
    exchangeRates.backfillMissingRates.mockRejectedValue(new Error('NBS nedostupan'));

    await expect(cron.runDailyImport()).resolves.toBeUndefined();

    // Današnji kurs je uspeo — a to je ono zbog čega posao postoji. Star nedostupan dan ne sme
    // svako jutro dizati uzbunu za problem koji niko ne rešava.
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('ne baca grešku dalje kad uvoz ne uspe — emituje informativan signal umesto toga', async () => {
    const { cron, exchangeRates, eventBus } = makeCron();
    exchangeRates.importFromNbs.mockRejectedValue(new Error('NBS stranica vratila HTTP 500'));

    await expect(cron.runDailyImport()).resolves.toBeUndefined();

    expect(eventBus.emit).toHaveBeenCalledWith(
      'M10',
      'exchange_rate_import_failed',
      expect.objectContaining({ message: 'NBS stranica vratila HTTP 500' }),
    );
  });
});
