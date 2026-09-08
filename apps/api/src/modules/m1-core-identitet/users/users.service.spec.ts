import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  function makeService() {
    const prisma = {
      user: {
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      userRole: {
        upsert: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      role: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'role-1', name: 'ROLE-1' }),
      },
      userPermissionOverride: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const auth = {
      createInviteToken: jest.fn().mockResolvedValue('raw-invite-token'),
      inviteTokenTtlHours: 48,
    };
    // Slanje pozivnice ne sme da utiče na poslovnu logiku ovog servisa (M1 spec §5) — mok
    // vraća `delivered: false`, tj. najgori slučaj, da testovi prolaze i kad pošta zakaže.
    const mailer = {
      send: jest.fn().mockResolvedValue({ delivered: false }),
      panelBaseUrl: () => 'http://localhost:3100',
      isConfigured: () => false,
    };
    const service = new UsersService(prisma as any, auditLog as any, auth as any, mailer as any);
    return { service, prisma, auditLog, auth, mailer };
  }

  describe('createPermissionOverride (M1 spec §3.6 — bezbednosna ograda)', () => {
    it('odbija kad korisnik pokušava da sebi dodeli/oduzme dozvolu (granted_by === user_id)', async () => {
      const { service, prisma } = makeService();

      await expect(
        service.createPermissionOverride(
          'user-1',
          { permissionId: 'p1', effect: 'ALLOW', reason: 'test' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.userPermissionOverride.create).not.toHaveBeenCalled();
    });

    it('kreira override za drugog korisnika i upisuje audit log sa razlogom', async () => {
      const { service, prisma, auditLog } = makeService();
      const created = {
        id: 'ov-1',
        userId: 'user-2',
        permissionId: 'p1',
        effect: 'ALLOW',
        reason: 'privremen pristup',
      };
      prisma.userPermissionOverride.create.mockResolvedValue(created);

      const result = await service.createPermissionOverride(
        'user-2',
        { permissionId: 'p1', effect: 'ALLOW', reason: 'privremen pristup' } as any,
        'actor-vlasnik',
      );

      expect(prisma.userPermissionOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            permissionId: 'p1',
            effect: 'ALLOW',
            reason: 'privremen pristup',
            grantedBy: 'actor-vlasnik',
          }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'M1',
          action: 'permission_override.grant',
          resourceId: 'ov-1',
        }),
      );
      expect(result).toBe(created);
    });

    it('prosleđuje expiresAt kao Date kad je prosleđen, inače null', async () => {
      const { service, prisma } = makeService();
      prisma.userPermissionOverride.create.mockResolvedValue({ id: 'ov-2' });

      await service.createPermissionOverride(
        'user-3',
        { permissionId: 'p1', effect: 'ALLOW', reason: 'test' } as any,
        'actor-1',
      );
      expect(prisma.userPermissionOverride.create.mock.calls[0][0].data.expiresAt).toBeNull();

      await service.createPermissionOverride(
        'user-3',
        {
          permissionId: 'p1',
          effect: 'ALLOW',
          reason: 'test',
          expiresAt: '2027-01-01T00:00:00.000Z',
        } as any,
        'actor-1',
      );
      expect(prisma.userPermissionOverride.create.mock.calls[1][0].data.expiresAt).toEqual(
        new Date('2027-01-01T00:00:00.000Z'),
      );
    });
  });

  describe('deletePermissionOverride', () => {
    it('briše override i upisuje audit log sa beforeState (za praćenje ko/kad je uklonio izuzetak)', async () => {
      const { service, prisma, auditLog } = makeService();
      const deleted = { id: 'ov-3', userId: 'user-4', effect: 'DENY' };
      prisma.userPermissionOverride.delete.mockResolvedValue(deleted);

      await service.deletePermissionOverride('ov-3', 'actor-1');

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission_override.revoke', beforeState: deleted }),
      );
    });
  });

  describe('suspend (M1 spec §6 — DELETE = meko gašenje)', () => {
    it('menja status na SUSPENDED, ne briše zapis, i opoziva aktivne refresh tokene', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-5', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({ id: 'user-5', status: 'SUSPENDED' });

      const result = await service.suspend('user-5', 'actor-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-5' },
        data: { status: 'SUSPENDED' },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-5', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.suspended',
          beforeState: { status: 'ACTIVE' },
          afterState: { status: 'SUSPENDED' },
        }),
      );
      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('assignRole / removeRole', () => {
    it('assignRole je idempotentno (upsert) i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();

      await service.assignRole('user-6', 'role-1', 'actor-1');

      expect(prisma.userRole.upsert).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 'user-6', roleId: 'role-1' } },
        update: {},
        create: { userId: 'user-6', roleId: 'role-1', assignedBy: 'actor-1' },
      });
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.role_assigned' }),
      );
    });

    it('removeRole briše dodelu i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();

      await service.removeRole('user-6', 'role-1', 'actor-1');

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 'user-6', roleId: 'role-1' } },
      });
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.role_removed' }),
      );
    });
  });

  describe('SEF_POSLOVNICE — kombinovana uloga, nikad samostalna (M24 spec §2.1)', () => {
    it('odbija dodelu SEF_POSLOVNICE kad bi korisnik ostao SAMO sa tom ulogom', async () => {
      const { service, prisma } = makeService();
      prisma.userRole.findMany.mockResolvedValue([]); // korisnik trenutno nema nijednu ulogu
      prisma.role.findUniqueOrThrow.mockResolvedValue({
        id: 'role-sef',
        name: 'SEF_POSLOVNICE',
      });

      await expect(service.assignRole('user-1', 'role-sef', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.userRole.upsert).not.toHaveBeenCalled();
    });

    it('odbija dodelu SEF_POSLOVNICE kad bi korisnik ostao sa DVE ILI VIŠE drugih uloga', async () => {
      const { service, prisma } = makeService();
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'PRODAJNI_AGENT' } },
        { role: { name: 'RACUNOVODJA' } },
      ]);
      prisma.role.findUniqueOrThrow.mockResolvedValue({
        id: 'role-sef',
        name: 'SEF_POSLOVNICE',
      });

      await expect(service.assignRole('user-1', 'role-sef', 'actor-1')).rejects.toThrow(
        'Šef poslovnice mora ići uz tačno jednu drugu ulogu',
      );
      expect(prisma.userRole.upsert).not.toHaveBeenCalled();
    });

    it('dozvoljava dodelu SEF_POSLOVNICE kad korisnik ima TAČNO jednu drugu ulogu', async () => {
      const { service, prisma } = makeService();
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'PRODAJNI_AGENT' } }]);
      prisma.role.findUniqueOrThrow.mockResolvedValue({
        id: 'role-sef',
        name: 'SEF_POSLOVNICE',
      });

      await service.assignRole('user-1', 'role-sef', 'actor-1');

      expect(prisma.userRole.upsert).toHaveBeenCalled();
    });

    it('odbija uklanjanje uloge kad bi SEF_POSLOVNICE ostao SAM (bez druge uloge)', async () => {
      const { service, prisma } = makeService();
      // Korisnik trenutno ima PRODAJNI_AGENT + SEF_POSLOVNICE; uklanja se PRODAJNI_AGENT.
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'PRODAJNI_AGENT' } },
        { role: { name: 'SEF_POSLOVNICE' } },
      ]);
      prisma.role.findUniqueOrThrow.mockResolvedValue({
        id: 'role-agent',
        name: 'PRODAJNI_AGENT',
      });

      await expect(service.removeRole('user-1', 'role-agent', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.userRole.delete).not.toHaveBeenCalled();
    });

    it('dozvoljava uklanjanje SEF_POSLOVNICE same (druga uloga ostaje)', async () => {
      const { service, prisma } = makeService();
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'PRODAJNI_AGENT' } },
        { role: { name: 'SEF_POSLOVNICE' } },
      ]);
      prisma.role.findUniqueOrThrow.mockResolvedValue({
        id: 'role-sef',
        name: 'SEF_POSLOVNICE',
      });

      await service.removeRole('user-1', 'role-sef', 'actor-1');

      expect(prisma.userRole.delete).toHaveBeenCalled();
    });
  });

  describe('invite (M1 spec §7 — kreira nalog u statusu INVITED)', () => {
    it('kreira korisnika sa status=INVITED, accountType=STAFF, dodeljuje uloge i traži invite token', async () => {
      const { service, prisma, auditLog, auth, mailer } = makeService();
      const created = { id: 'user-7', email: 'novi@tt.rs', status: 'INVITED' };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.invite(
        { email: 'novi@tt.rs', fullName: 'Novi Korisnik', roleIds: ['role-a', 'role-b'] } as any,
        'actor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'novi@tt.rs',
            accountType: 'STAFF',
            status: 'INVITED',
          }),
        }),
      );
      expect(auth.createInviteToken).toHaveBeenCalledWith('user-7');
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.invited' }),
      );
      // `emailDelivered` (dopuna 4.9.2026) kaže panelu da li je pozivnica stvarno otišla —
      // ovde je `false` jer mok pošte simulira nepodešen SMTP; ekran tada prikazuje link za
      // ručno prosleđivanje. Sam poziv mora biti napravljen bez obzira na ishod.
      expect(result).toEqual({
        user: created,
        inviteToken: 'raw-invite-token',
        emailDelivered: false,
      });
      expect(mailer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'novi@tt.rs',
          text: expect.stringContaining('raw-invite-token'),
        }),
      );
    });

    it('franšizni nalog (linkedProfileId postavljen) sme da pozove naloge SAMO sopstvene franšize (M1 §5, M7 §2.0.7)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'franchise-direktor-1',
        linkedProfileId: 'subagent-fr-1',
      });
      prisma.user.create.mockResolvedValue({ id: 'user-8' });

      await service.invite(
        {
          email: 'novi@fransiza.rs',
          fullName: 'Novi',
          roleIds: [],
          linkedProfileId: 'subagent-fr-1',
        } as any,
        'franchise-direktor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ linkedProfileId: 'subagent-fr-1' }),
        }),
      );
    });

    it('franšizni nalog NE sme da pozove nalog van sopstvene franšize (tuđa franšiza ili matična agencija)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'franchise-direktor-1',
        linkedProfileId: 'subagent-fr-1',
      });

      await expect(
        service.invite(
          {
            email: 'x@y.rs',
            fullName: 'X',
            roleIds: [],
            linkedProfileId: 'subagent-fr-DRUGA',
          } as any,
          'franchise-direktor-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('matična agencija (bez linkedProfileId) sme da pozove nalog za bilo koju franšizu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'hq-direktor-1', linkedProfileId: null });
      prisma.user.create.mockResolvedValue({ id: 'user-9' });

      await service.invite(
        {
          email: 'x@y.rs',
          fullName: 'X',
          roleIds: [],
          linkedProfileId: 'bilo-koja-fransiza',
        } as any,
        'hq-direktor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ linkedProfileId: 'bilo-koja-fransiza' }),
        }),
      );
    });
  });

  describe('directory (dopuna 31.8.2026 — M5 §6.5, lagan spisak kolega bez M1/user/VIEW)', () => {
    it('STAFF pozivalac dobija spisak, samo id+fullName (bez email/uloga)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', fullName: 'Ana' }]);

      const result = await service.directory('staff-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountType: 'STAFF', status: 'ACTIVE' },
          select: { id: true, fullName: true },
        }),
      );
      expect(result).toEqual([{ id: 'u1', fullName: 'Ana' }]);
    });

    it('gost/subagent/nepostojeći pozivalac dobija praznu listu, ne 500/leak', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'guest-1', accountType: 'GUEST' });

      const result = await service.directory('guest-1');

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('sa `role` filterom (npr. VODIC) vraća i phone/email — dopuna 2.9.2026, kartica Predstavnici', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', fullName: 'Ana', phone: '+381601234567', email: 'ana@tt.rs' },
      ]);

      const result = await service.directory('staff-1', 'VODIC');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountType: 'STAFF',
            status: 'ACTIVE',
            roles: { some: { role: { name: 'VODIC' } } },
          },
          select: { id: true, fullName: true, phone: true, email: true },
        }),
      );
      expect(result).toEqual([
        { id: 'u1', fullName: 'Ana', phone: '+381601234567', email: 'ana@tt.rs' },
      ]);
    });
  });
});

describe('UsersService.findAll — straničenje + pretraga na serveru (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const auditLog = { write: jest.fn() };
    const auth = {};
    const mailer = {};
    const service = new UsersService(prisma, auditLog as any, auth as any, mailer as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.findAll();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 50 }),
    );
    expect(result).toMatchObject({ data: [{ id: 'u1' }], total: 1, page: 1, limit: 50 });
  });

  it('pretraga (q) ide na server preko OR fullName/email, ne klijentski', async () => {
    const { service, prisma } = makeService();

    await service.findAll('ana');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { fullName: { contains: 'ana', mode: 'insensitive' } },
            { email: { contains: 'ana', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
