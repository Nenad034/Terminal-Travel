import { NotFoundException } from '@nestjs/common';
import { ProcessMapsService } from './process-maps.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

// `AuditLogService.find()` od 6.9.2026. vraća straničen odgovor (dok. 39 nalaz 2.2), ne go
// niz — `data` je jedna stranica, `total` je stvaran broj redova koji odgovaraju filteru.
// Procesna mapa traži `limit: 1`, pa se ta dva broja NAMERNO razlikuju u testovima ispod:
// upravo je razlika između „koliko sam povukao" i „koliko ih ima" bila jezgro nalaza.
function stranica(data: unknown[], total: number) {
  return { data, total, page: 1, limit: 1, pageCount: Math.max(1, total), hasMore: total > 1 };
}

describe('ProcessMapsService', () => {
  function makeService() {
    const auditLog = { find: jest.fn() } as unknown as jest.Mocked<AuditLogService>;
    const service = new ProcessMapsService(auditLog);
    return { service, auditLog };
  }

  it('findAll vraća sve registrovane mape — "m1-security", "m5-booking-flow", "m10-money-flow", "m7-subagent-flow" (M18 spec §9a)', () => {
    const { service } = makeService();
    const maps = service.findAll();
    expect(maps).toHaveLength(4);

    const m1 = maps.find((m) => m.key === 'm1-security');
    expect(m1).toMatchObject({ module: 'M1' });
    expect(m1?.nodes.map((n) => n.id)).toEqual(['login-success', 'login-failed', 'mfa-failed', 'account-locked', 'password-reset']);

    const m5 = maps.find((m) => m.key === 'm5-booking-flow');
    expect(m5).toMatchObject({ module: 'M5' });
    expect(m5?.nodes.map((n) => n.id)).toEqual([
      'booking-created',
      'booking-modified',
      'payment-status-changed',
      'voucher-override',
      'booking-cancelled',
    ]);

    const m10 = maps.find((m) => m.key === 'm10-money-flow');
    expect(m10).toMatchObject({ module: 'M10' });
    expect(m10?.nodes.map((n) => n.id)).toEqual([
      'payment-recorded',
      'invoice-created',
      'invoice-storno',
      'supplier-obligation-created',
      'supplier-obligation-paid',
      'refund-executed',
    ]);

    const m7 = maps.find((m) => m.key === 'm7-subagent-flow');
    expect(m7).toMatchObject({ module: 'M7' });
    expect(m7?.nodes.map((n) => n.id)).toEqual([
      'subagent-registered',
      'subagent-approved',
      'subagent-updated',
      'commission-ceiling-warning',
      'rebate-created',
      'rebate-approved',
      'rebate-applied',
      'rebate-rejected',
    ]);
  });

  it('live() baca NotFoundException za nepoznat ključ', async () => {
    const { service } = makeService();
    await expect(service.live('nepostojeca-mapa')).rejects.toThrow(NotFoundException);
  });

  it('live() vraća broj i vreme poslednjeg zapisa po čvoru, čitano iz M1 audit loga (poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockImplementation(({ actions }: { actions: string[] }) => {
      if (actions.includes('auth.login_failed')) {
        // Straničen odgovor (6.9.2026): mapa traži `limit: 1`, pa `data` nosi samo najnoviji
        // red, a broj dolazi iz `total` — zato ovde `data` ima jedan element, a `total` dva.
        return Promise.resolve(stranica([{ timestamp: new Date('2026-08-29T10:00:00.000Z') }], 2));
      }
      return Promise.resolve(stranica([], 0));
    });

    const result = await service.live('m1-security', 60);

    expect(auditLog.find).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M1', actions: ['auth.login_failed'] }),
      { limit: 1 },
    );
    const loginFailedNode = result.nodes.find((n) => n.id === 'login-failed');
    expect(loginFailedNode).toEqual({
      id: 'login-failed',
      label: 'Pogrešna lozinka',
      count: 2,
      lastAt: '2026-08-29T10:00:00.000Z',
    });
    const loginSuccessNode = result.nodes.find((n) => n.id === 'login-success');
    expect(loginSuccessNode).toEqual({ id: 'login-success', label: 'Uspešna prijava', count: 0, lastAt: null });
  });

  it('live() za "m5-booking-flow" čita iz modula M5, ne M1 (poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockImplementation(({ module, actions }: { module: string; actions: string[] }) => {
      if (module === 'M5' && actions.includes('booking.confirmed')) {
        return Promise.resolve(stranica([{ timestamp: new Date('2026-08-29T12:00:00.000Z') }], 1));
      }
      return Promise.resolve(stranica([], 0));
    });

    const result = await service.live('m5-booking-flow');

    expect(auditLog.find).toHaveBeenCalledWith(expect.objectContaining({ module: 'M5', actions: ['booking.confirmed'] }), { limit: 1 });
    const created = result.nodes.find((n) => n.id === 'booking-created');
    expect(created).toEqual({ id: 'booking-created', label: 'Rezervacija kreirana', count: 1, lastAt: '2026-08-29T12:00:00.000Z' });
  });

  it('live() za "m10-money-flow" prosleđuje SVE matchActions čvora u jedan poziv (obaveza dobavljaču ima dva izvora, poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(stranica([], 0));

    await service.live('m10-money-flow');

    expect(auditLog.find).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M10', actions: ['supplier_obligation.created', 'supplier_obligation.auto_created'] }),
      { limit: 1 },
    );
  });

  it('live() za "m7-subagent-flow" čita iz modula M7 i spaja registered+child_registered u jedan čvor (poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(stranica([], 0));

    await service.live('m7-subagent-flow');

    expect(auditLog.find).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M7', actions: ['subagent.registered', 'subagent.child_registered'] }),
      { limit: 1 },
    );
  });

  // Zamena za raniji test „označava čvor kao capped kad broj dostigne 200" (uklonjen 6.9.2026).
  // Taj test je čuvao ponašanje koje je bilo priznanje neznanja: broj se dobijao brojanjem
  // povučenih redova, pa je čvor sa 5.000 događaja pisao „200+". Otkad audit log ima
  // straničenje (dok. 39 nalaz 2.2), broj je tačan i gornje granice nema — pa se testira to.
  it('broj čvora je TAČAN i kad ih ima više od nekadašnje granice od 200 (nema više „200+")', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(stranica([{ timestamp: new Date() }], 5000));

    const result = await service.live('m1-security');

    expect(result.nodes.every((n) => n.count === 5000)).toBe(true);
  });

  it('povlači JEDAN red po čvoru, ne dvesta — za čvor treba samo poslednje vreme', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(stranica([], 0));

    await service.live('m1-security');

    for (const poziv of (auditLog.find as jest.Mock).mock.calls) {
      expect(poziv[1]).toEqual({ limit: 1 });
    }
  });
});
