import { AgencySettingsService } from './agency-settings.service';

// M1 spec §3.9c. Mokovan Prisma, isti obrazac kao ostali M1 unit testovi.
function napravi(zatecено?: Partial<Record<string, unknown>>) {
  const red = { id: 'singleton', brandName: 'Terminal Travel', ...zatecено };
  const prisma = {
    agencySettings: {
      upsert: jest.fn().mockResolvedValue(red),
      update: jest.fn().mockImplementation(({ data }: any) => ({ ...red, ...data })),
    },
  };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  return { servis: new AgencySettingsService(prisma as any, auditLog as any), prisma, auditLog };
}

describe('AgencySettingsService (M1 spec §3.9c — identitet agencije)', () => {
  it('uvek radi nad JEDNIM redom (singleton), nikad ne pravi drugi', async () => {
    const { servis, prisma } = napravi();
    await servis.get();
    expect(prisma.agencySettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'singleton' } }),
    );
  });

  // Prazna baza (svež klon, testno okruženje) ne sme da obori svaki ekran koji traži naziv
  // agencije — a to je podnožje sajta i naslov svake stranice.
  it('vraća red i kad ga u bazi nije bilo — ne baca grešku', async () => {
    const { servis, prisma } = napravi();
    await servis.get();
    expect(prisma.agencySettings.upsert.mock.calls[0][0].create).toMatchObject({
      id: 'singleton',
    });
  });

  // Suprotan smer istog dokaza — nije dovoljno da javan endpoint nešto vrati, mora se dokazati
  // da NE vraća ono što ne sme. `taxId`/`licenseNumber` stoje samo na ugovoru (M20 §2.3).
  it('javan oblik NE sadrži PIB ni broj licence', async () => {
    const { servis } = napravi({
      taxId: '123456789',
      licenseNumber: 'OTP 123/2026',
      email: 'info@primer.rs',
    });
    const javno = await servis.getPublic();

    expect(javno.email).toBe('info@primer.rs');
    expect(Object.keys(javno)).toEqual(['brandName', 'email', 'phone', 'website', 'address']);
    expect(JSON.stringify(javno)).not.toContain('123456789');
    expect(JSON.stringify(javno)).not.toContain('OTP 123/2026');
  });

  it('izmena upisuje u audit log sa stanjem pre i posle (§3.8)', async () => {
    const { servis, auditLog } = napravi();
    await servis.update({ brandName: 'Novo Ime' }, 'korisnik-1');

    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'M1',
        action: 'agency_settings.updated',
        actorId: 'korisnik-1',
        beforeState: expect.objectContaining({ brandName: 'Terminal Travel' }),
        afterState: expect.objectContaining({ brandName: 'Novo Ime' }),
      }),
    );
  });

  it('beleži KO je menjao (updatedByUserId), ne samo šta', async () => {
    const { servis, prisma } = napravi();
    await servis.update({ address: 'Nova adresa 1' }, 'korisnik-7');
    expect(prisma.agencySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ updatedByUserId: 'korisnik-7' }) }),
    );
  });
});
