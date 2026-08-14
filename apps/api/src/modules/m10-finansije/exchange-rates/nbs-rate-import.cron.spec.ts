import { NbsRateImportCron } from './nbs-rate-import.cron';

describe('NbsRateImportCron (M10 spec §11)', () => {
  function makeCron() {
    const exchangeRates: any = { importFromNbs: jest.fn() };
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
