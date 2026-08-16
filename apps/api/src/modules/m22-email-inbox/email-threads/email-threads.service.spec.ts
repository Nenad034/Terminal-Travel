import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmailThreadsService } from './email-threads.service';

describe('EmailThreadsService (M22 spec §2.2/§8)', () => {
  function makeService() {
    const prisma = {
      mailboxAccess: { findMany: jest.fn(), findUnique: jest.fn() },
      emailThread: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      emailMessage: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      booking: { findUnique: jest.fn() },
      supplierManifest: { findUnique: jest.fn() },
      supplierChangeNotice: { findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const mailboxes = { findAccess: jest.fn(), findOne: jest.fn() };
    const providerFactory = { getAdapter: jest.fn() };
    const correspondentMatcher = { match: jest.fn() };
    const referenceMatcher = { match: jest.fn() };
    const aiAssistant = { processInboundMessage: jest.fn() };
    const service = new EmailThreadsService(
      prisma as any,
      auditLog as any,
      mailboxes as any,
      providerFactory as any,
      correspondentMatcher as any,
      referenceMatcher as any,
      aiAssistant as any,
    );
    return { service, prisma, auditLog, mailboxes, providerFactory, correspondentMatcher, referenceMatcher, aiAssistant };
  }

  describe('findMany — scoping (§2.2)', () => {
    it('vraća prazno ako korisnik nema NIJEDAN MailboxAccess, čak i uz široku ulogu (RBAC katalog dozvola)', async () => {
      const { service, prisma } = makeService();
      prisma.mailboxAccess.findMany.mockResolvedValue([]);

      const result = await service.findMany('vlasnik-1', {});

      expect(result).toEqual([]);
      expect(prisma.emailThread.findMany).not.toHaveBeenCalled();
    });

    it('filtrira SAMO na mailboxId za koje postoji MailboxAccess', async () => {
      const { service, prisma } = makeService();
      prisma.mailboxAccess.findMany.mockResolvedValue([{ mailboxId: 'mb-1' }, { mailboxId: 'mb-2' }]);
      prisma.emailThread.findMany.mockResolvedValue([]);

      await service.findMany('user-1', {});

      expect(prisma.emailThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ mailboxId: { in: ['mb-1', 'mb-2'] } }) }),
      );
    });

    it('vraća prazno ako traženi mailboxId nije u dodeljenom skupu (pokušaj zaobilaženja preko filtera)', async () => {
      const { service, prisma } = makeService();
      prisma.mailboxAccess.findMany.mockResolvedValue([{ mailboxId: 'mb-1' }]);

      const result = await service.findMany('user-1', { mailboxId: 'mb-tudje' });

      expect(result).toEqual([]);
      expect(prisma.emailThread.findMany).not.toHaveBeenCalled();
    });

    // Nedostatak 2 (M17 Faza 7, rešeno) — payload uključuje naziv/adresu sandučeta na koje
    // pozivalac već ima MailboxAccess, bez dodatne M22/mailbox/VIEW dozvole.
    it('uključuje mailbox.address/displayName u upit — isti scoping, prošireni payload', async () => {
      const { service, prisma } = makeService();
      prisma.mailboxAccess.findMany.mockResolvedValue([{ mailboxId: 'mb-1' }]);
      prisma.emailThread.findMany.mockResolvedValue([
        { id: 't1', mailboxId: 'mb-1', mailbox: { address: 'rezervacije@tt.rs', displayName: 'Rezervacije' } },
      ]);

      const result = await service.findMany('user-1', {});

      expect(prisma.emailThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { mailbox: { select: { address: true, displayName: true } } } }),
      );
      expect(result[0].mailbox).toEqual({ address: 'rezervacije@tt.rs', displayName: 'Rezervacije' });
    });
  });

  describe('findOne — pristup (§2.2)', () => {
    it('baca ForbiddenException ako pozivalac nema MailboxAccess za sanduče niti', async () => {
      const { service, prisma, mailboxes } = makeService();
      prisma.emailThread.findUnique.mockResolvedValue({ id: 't1', mailboxId: 'mb-1' });
      mailboxes.findAccess.mockResolvedValue(null);

      await expect(service.findOne('t1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('baca NotFoundException ako nit ne postoji', async () => {
      const { service, prisma } = makeService();
      prisma.emailThread.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nepostojeci', 'user-1')).rejects.toThrow(NotFoundException);
    });

    // Nedostatak 2 (M17 Faza 7, rešeno)
    it('uključuje mailbox.address/displayName u findUnique upit i vraća ih u odgovoru', async () => {
      const { service, prisma, mailboxes } = makeService();
      prisma.emailThread.findUnique.mockResolvedValue({
        id: 't1',
        mailboxId: 'mb-1',
        mailbox: { address: 'gosti@tt.rs', displayName: 'Gosti' },
      });
      mailboxes.findAccess.mockResolvedValue({ accessLevel: 'VIEW' });

      const result = await service.findOne('t1', 'user-1');

      expect(prisma.emailThread.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ mailbox: { select: { address: true, displayName: true } } }) }),
      );
      expect(result.mailbox).toEqual({ address: 'gosti@tt.rs', displayName: 'Gosti' });
    });
  });

  describe('createMessage — REPLY zahtev (§8)', () => {
    it('odbija sa VIEW nivoom pristupa (potreban REPLY)', async () => {
      const { service, prisma, mailboxes } = makeService();
      prisma.emailThread.findUnique.mockResolvedValue({ id: 't1', mailboxId: 'mb-1', subject: 's', status: 'OPEN' });
      mailboxes.findAccess.mockResolvedValue({ accessLevel: 'VIEW' });

      await expect(service.createMessage('t1', { body: 'odgovor' }, 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('linkSupplierAnnouncement — nikad ne dodiruje M5 potvrdu (§3.1a)', () => {
    it('upisuje SAMO relatedSupplierManifestId, ne poziva nijedan M5 confirm servis', async () => {
      const { service, prisma, mailboxes } = makeService();
      prisma.emailThread.findUnique.mockResolvedValue({ id: 't1', mailboxId: 'mb-1' });
      mailboxes.findAccess.mockResolvedValue({ accessLevel: 'REPLY' });
      prisma.supplierManifest.findUnique.mockResolvedValue({ id: 'sm-1' });
      prisma.emailThread.update.mockResolvedValue({ id: 't1', relatedSupplierManifestId: 'sm-1' });

      await service.linkSupplierAnnouncement('t1', { announcementType: 'SUPPLIER_MANIFEST', announcementId: 'sm-1' }, 'user-1');

      expect(prisma.emailThread.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { relatedSupplierManifestId: 'sm-1' } });
    });
  });

  describe('receiveInboundMessage (§3.1/§3.1a/§4/§9)', () => {
    it('za novu nit pokreće CorrespondentMatcherService i uvek poziva EmailAiAssistantService na inbound poruku', async () => {
      const { service, prisma, mailboxes, correspondentMatcher, aiAssistant } = makeService();
      mailboxes.findOne.mockResolvedValue({ id: 'mb-1', isSupplierUnifiedInbox: false });
      prisma.emailThread.findFirst.mockResolvedValue(null);
      correspondentMatcher.match.mockResolvedValue({ correspondentType: 'GUEST', correspondentClientAccountId: 'ca-1', correspondentSupplierId: null });
      prisma.emailThread.create.mockResolvedValue({ id: 'new-thread' });
      prisma.emailMessage.create.mockResolvedValue({ id: 'msg-1' });

      await service.receiveInboundMessage('mb-1', {
        fromAddress: 'gost@primer.rs',
        toAddresses: ['rezervacije@tt.rs'],
        subject: 'Upit',
        body: 'Zdravo',
        providerMessageId: 'pm-1',
        receivedAt: new Date().toISOString(),
      });

      expect(correspondentMatcher.match).toHaveBeenCalledWith('gost@primer.rs');
      expect(aiAssistant.processInboundMessage).toHaveBeenCalledWith({ id: 'msg-1' });
    });

    it('za jedinstveno sanduče dobavljača (§8.8) pokreće i ReferenceMatcherService i postavlja correspondentType=SUPPLIER', async () => {
      const { service, prisma, mailboxes, referenceMatcher, correspondentMatcher } = makeService();
      mailboxes.findOne.mockResolvedValue({ id: 'mb-supplier', isSupplierUnifiedInbox: true });
      prisma.emailThread.findFirst.mockResolvedValue(null);
      correspondentMatcher.match.mockResolvedValue({ correspondentType: 'OTHER', correspondentClientAccountId: null, correspondentSupplierId: null });
      referenceMatcher.match.mockResolvedValue({ matchType: 'EXACT_REFERENCE', relatedSupplierManifestId: 'sm-1', relatedSupplierChangeNoticeId: null });
      prisma.emailThread.create.mockResolvedValue({ id: 'new-thread-2' });
      prisma.emailMessage.create.mockResolvedValue({ id: 'msg-2' });

      await service.receiveInboundMessage('mb-supplier', {
        fromAddress: 'hotel@dobavljac.rs',
        toAddresses: ['dobavljaci@tt.rs'],
        subject: '[REF: TT-000123] Potvrda',
        body: 'telo',
        providerMessageId: 'pm-2',
        receivedAt: new Date().toISOString(),
      });

      expect(referenceMatcher.match).toHaveBeenCalled();
      expect(prisma.emailThread.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ correspondentType: 'SUPPLIER', relatedSupplierManifestId: 'sm-1' }) }),
      );
    });
  });
});
