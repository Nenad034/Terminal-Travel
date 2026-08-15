import { NotificationDispatchService } from './notification-dispatch.service';
import { encryptSecret } from '../../../common/crypto/secret-box';

// M18 spec §2.2/§3 — dispečer poziva sve ACTIVE kanale; graceful no-op kad kredencijal nije
// podešen (TelegramClientService.isConfigured()===false) je odgovornost samog klijenta
// (testirano indirektno ovde preko mock-ova koji simuliraju i graceful i uspešan slučaj).
describe('NotificationDispatchService (M18 spec §2.2, §3)', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-notification-dispatch-spec';
  });
  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  function makeService(channels: { channelType: string; config: Record<string, unknown> }[]) {
    const dbChannels = channels.map((c, i) => ({
      id: `chan-${i}`,
      channelType: c.channelType,
      configEncrypted: encryptSecret(JSON.stringify(c.config)),
      status: 'ACTIVE',
    }));
    const prisma = {
      notificationChannel: { findMany: jest.fn().mockResolvedValue(dbChannels) },
      healthSignal: { update: jest.fn().mockResolvedValue({}) },
    };
    const telegram = { send: jest.fn().mockResolvedValue(undefined) };
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    return { service: new NotificationDispatchService(prisma as any, telegram as any, email as any), prisma, telegram, email };
  }

  it('poziva TelegramClientService.send za svaki ACTIVE TELEGRAM kanal, sa dekriptovanim chatId', async () => {
    const { service, telegram } = makeService([{ channelType: 'TELEGRAM', config: { chatId: '12345' } }]);
    await service.dispatchText('test poruka');
    expect(telegram.send).toHaveBeenCalledWith('12345', 'test poruka');
  });

  it('poziva EmailClientService.send za svaki ACTIVE EMAIL kanal, sa dekriptovanim email-om', async () => {
    const { service, email } = makeService([{ channelType: 'EMAIL', config: { email: 'vlasnik@primer.rs' } }]);
    await service.dispatchText('test poruka');
    expect(email.send).toHaveBeenCalledWith('vlasnik@primer.rs', expect.any(String), 'test poruka');
  });

  it('iterira sve ACTIVE kanale (i Telegram i email) u jednom dispatch pozivu', async () => {
    const { service, telegram, email } = makeService([
      { channelType: 'TELEGRAM', config: { chatId: '1' } },
      { channelType: 'EMAIL', config: { email: 'a@b.rs' } },
    ]);
    await service.dispatchText('poruka');
    expect(telegram.send).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('dispatch(signal) upisuje notifiedAt na signal posle isporuke', async () => {
    const { service, prisma } = makeService([]);
    await service.dispatch({ id: 'sig-1', sourceModule: 'M4', signalType: 'PROVIDER_DEGRADED', severity: 'CRITICAL', details: {} } as any);
    expect(prisma.healthSignal.update).toHaveBeenCalledWith({ where: { id: 'sig-1' }, data: { notifiedAt: expect.any(Date) } });
  });

  it('IN_APP kanal ne baca grešku (čist stub dok M19 ne postoji)', async () => {
    const { service } = makeService([{ channelType: 'IN_APP', config: {} }]);
    await expect(service.dispatchText('poruka')).resolves.toBeUndefined();
  });
});
