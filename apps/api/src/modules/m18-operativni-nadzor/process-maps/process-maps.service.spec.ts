import { NotFoundException } from '@nestjs/common';
import { ProcessMapsService } from './process-maps.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

describe('ProcessMapsService', () => {
  function makeService() {
    const auditLog = { find: jest.fn() } as unknown as jest.Mocked<AuditLogService>;
    const service = new ProcessMapsService(auditLog);
    return { service, auditLog };
  }

  it('findAll vraća oba registrovana čvora — "m1-security" i "m5-booking-flow" (M18 spec §9a)', () => {
    const { service } = makeService();
    const maps = service.findAll();
    expect(maps).toHaveLength(2);

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
  });

  it('live() baca NotFoundException za nepoznat ključ', async () => {
    const { service } = makeService();
    await expect(service.live('nepostojeca-mapa')).rejects.toThrow(NotFoundException);
  });

  it('live() vraća broj i vreme poslednjeg zapisa po čvoru, čitano iz M1 audit loga (poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockImplementation(({ actions }: { actions: string[] }) => {
      if (actions.includes('auth.login_failed')) {
        return Promise.resolve([
          { timestamp: new Date('2026-08-29T10:00:00.000Z') },
          { timestamp: new Date('2026-08-29T09:00:00.000Z') },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.live('m1-security', 60);

    expect(auditLog.find).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M1', actions: ['auth.login_failed'] }),
    );
    const loginFailedNode = result.nodes.find((n) => n.id === 'login-failed');
    expect(loginFailedNode).toEqual({
      id: 'login-failed',
      label: 'Pogrešna lozinka',
      count: 2,
      capped: false,
      lastAt: '2026-08-29T10:00:00.000Z',
    });
    const loginSuccessNode = result.nodes.find((n) => n.id === 'login-success');
    expect(loginSuccessNode).toEqual({ id: 'login-success', label: 'Uspešna prijava', count: 0, capped: false, lastAt: null });
  });

  it('live() za "m5-booking-flow" čita iz modula M5, ne M1 (poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockImplementation(({ module, actions }: { module: string; actions: string[] }) => {
      if (module === 'M5' && actions.includes('booking.confirmed')) {
        return Promise.resolve([{ timestamp: new Date('2026-08-29T12:00:00.000Z') }]);
      }
      return Promise.resolve([]);
    });

    const result = await service.live('m5-booking-flow');

    expect(auditLog.find).toHaveBeenCalledWith(expect.objectContaining({ module: 'M5', actions: ['booking.confirmed'] }));
    const created = result.nodes.find((n) => n.id === 'booking-created');
    expect(created).toEqual({ id: 'booking-created', label: 'Rezervacija kreirana', count: 1, capped: false, lastAt: '2026-08-29T12:00:00.000Z' });
  });

  it('označava čvor kao "capped" kad broj zapisa dostigne limit od 200 (M1 spec — AuditLogService.find, poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(Array.from({ length: 200 }, () => ({ timestamp: new Date() })));

    const result = await service.live('m1-security');

    expect(result.nodes.every((n) => n.capped)).toBe(true);
  });
});
