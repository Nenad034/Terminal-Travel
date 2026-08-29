import { NotFoundException } from '@nestjs/common';
import { ProcessMapsService } from './process-maps.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

describe('ProcessMapsService', () => {
  function makeService() {
    const auditLog = { find: jest.fn() } as unknown as jest.Mocked<AuditLogService>;
    const service = new ProcessMapsService(auditLog);
    return { service, auditLog };
  }

  it('findAll vraća registrovani pilot "m1-security" (M18 spec §9a)', () => {
    const { service } = makeService();
    const maps = service.findAll();
    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ key: 'm1-security', module: 'M1' });
    expect(maps[0].nodes.map((n) => n.id)).toEqual([
      'login-success',
      'login-failed',
      'mfa-failed',
      'account-locked',
      'password-reset',
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

  it('označava čvor kao "capped" kad broj zapisa dostigne limit od 200 (M1 spec — AuditLogService.find, poglavlje 9a)', async () => {
    const { service, auditLog } = makeService();
    (auditLog.find as jest.Mock).mockResolvedValue(Array.from({ length: 200 }, () => ({ timestamp: new Date() })));

    const result = await service.live('m1-security');

    expect(result.nodes.every((n) => n.capped)).toBe(true);
  });
});
