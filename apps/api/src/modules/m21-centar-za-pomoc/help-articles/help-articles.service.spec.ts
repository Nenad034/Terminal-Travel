import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HelpArticlesService } from './help-articles.service';

// M21 spec §3/§7 — vidljivost po publici je izvedena UŽIVO iz pozivaoca (account_type/
// ClientAccount.account_type), NIKAD iz parametra, i uvek proverena i kroz M1 Permission
// zapis (article:<segment>/VIEW), ne samo kroz izvedenu publiku.
describe('HelpArticlesService (M21 spec §3/§7 — vidljivost po publici)', () => {
  function makeService() {
    const prisma = {
      user: { findUnique: jest.fn() },
      clientAccount: { findUnique: jest.fn() },
      helpArticle: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      helpArticleTranslation: { upsert: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const permissions = { hasPermission: jest.fn() };
    const service = new HelpArticlesService(prisma as any, auditLog as any, permissions as any);
    return { service, prisma, auditLog, permissions };
  }

  it('INDIVIDUAL GUEST (van obima v1) ne vidi nijedan članak', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', accountType: 'GUEST', linkedProfileId: 'ca1' });
    prisma.clientAccount.findUnique.mockResolvedValue({ id: 'ca1', accountType: 'INDIVIDUAL' });

    const result = await service.findVisibleToCaller('u1', {});

    expect(result).toEqual([]);
    // Provera je i strukturna: audience je null pre nego što se permission uopšte ispita.
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });

  it('nalog bez rešive publike (npr. SUPPLIER_CONTACT) dobija praznu listu', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', accountType: 'SUPPLIER_CONTACT', linkedProfileId: null });

    expect(await service.findVisibleToCaller('u2', {})).toEqual([]);
  });

  it('STAFF nalog SA article:staff/VIEW dozvolom vidi objavljene STAFF članke', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF', linkedProfileId: null });
    permissions.hasPermission.mockResolvedValue(true);
    prisma.helpArticle.findMany.mockResolvedValue([
      { id: 'a1', audience: ['STAFF'], isCriticalExample: false, translations: [{ languageCode: 'sr', title: 'T', body: 'B' }] },
    ]);

    const result = await service.findVisibleToCaller('staff-1', {});

    expect(prisma.helpArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED', audience: { has: 'STAFF' } }) }),
    );
    expect(result).toHaveLength(1);
  });

  it('STAFF nalog BEZ article:staff/VIEW dozvole (npr. DENY override) ne vidi ništa uprkos rešivoj publici', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'staff-2', accountType: 'STAFF', linkedProfileId: null });
    permissions.hasPermission.mockResolvedValue(false);

    const result = await service.findVisibleToCaller('staff-2', {});

    expect(result).toEqual([]);
    expect(prisma.helpArticle.findMany).not.toHaveBeenCalled();
  });

  it('SUBAGENT_CONTACT nalog vidi isključivo SUBAGENT publiku', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'sub-1', accountType: 'SUBAGENT_CONTACT', linkedProfileId: null });
    permissions.hasPermission.mockResolvedValue(true);
    prisma.helpArticle.findMany.mockResolvedValue([]);

    await service.findVisibleToCaller('sub-1', {});

    expect(prisma.helpArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ audience: { has: 'SUBAGENT' } }) }),
    );
  });

  it('GUEST povezan sa LEGAL_ENTITY ClientAccount vidi BUSINESS_CLIENT publiku', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'guest-biz', accountType: 'GUEST', linkedProfileId: 'ca-biz' });
    prisma.clientAccount.findUnique.mockResolvedValue({ id: 'ca-biz', accountType: 'LEGAL_ENTITY' });
    permissions.hasPermission.mockResolvedValue(true);
    prisma.helpArticle.findMany.mockResolvedValue([]);

    await service.findVisibleToCaller('guest-biz', {});

    expect(prisma.helpArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ audience: { has: 'BUSINESS_CLIENT' } }) }),
    );
  });

  it('create() odbija kad pozivalac nema EDIT za bar jedan navedeni audience segment', async () => {
    const { service, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(false);

    await expect(
      service.create({ slug: 'novi-clanak', audience: ['STAFF', 'BUSINESS_CLIENT'] } as any, 'hr-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update() prelaska u PUBLISHED zahteva PUBLISH dozvolu i popunjava approved_by, ne AI', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.helpArticle.findUnique
      .mockResolvedValueOnce({ id: 'a1', audience: ['STAFF'], status: 'PENDING_APPROVAL' })
      .mockResolvedValueOnce({ id: 'a1', audience: ['STAFF'], translations: [{ languageCode: 'sr' }] });
    permissions.hasPermission.mockResolvedValue(true);
    prisma.helpArticle.update.mockResolvedValue({ id: 'a1', status: 'PUBLISHED', approvedBy: 'direktor-1' });

    const result = await service.update('a1', { status: 'PUBLISHED' } as any, 'direktor-1');

    expect(prisma.helpArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedBy: 'direktor-1', status: 'PUBLISHED' }) }),
    );
    expect(result.approvedBy).toBe('direktor-1');
  });

  it('update() u PUBLISHED bez ijednog prevoda baca BadRequestException', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.helpArticle.findUnique
      .mockResolvedValueOnce({ id: 'a1', audience: ['STAFF'], status: 'PENDING_APPROVAL' })
      .mockResolvedValueOnce({ id: 'a1', audience: ['STAFF'], translations: [] });
    permissions.hasPermission.mockResolvedValue(true);

    await expect(service.update('a1', { status: 'PUBLISHED' } as any, 'direktor-1')).rejects.toThrow(BadRequestException);
  });
});
