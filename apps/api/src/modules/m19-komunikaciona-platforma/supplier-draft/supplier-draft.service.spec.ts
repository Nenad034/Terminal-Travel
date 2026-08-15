import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupplierDraftService } from './supplier-draft.service';

describe('SupplierDraftService (M19 spec §9.5 — nikad izvršenje, samo nacrt)', () => {
  function makeService() {
    const prisma = {
      conversation: { findUnique: jest.fn() },
      conversationParticipant: { findUnique: jest.fn() },
      message: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const anthropic = { isConfigured: jest.fn(), getClient: jest.fn() };
    const invocationLog = { record: jest.fn() };
    const service = new SupplierDraftService(prisma as any, auditLog as any, anthropic as any, invocationLog as any);
    return { service, prisma, auditLog, anthropic, invocationLog };
  }

  it('baca NotFoundException za razgovor koji nije EXTERNAL_SUPPLIER', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'DIRECT' });

    await expect(service.draftReply('c1', {}, 'staff-1')).rejects.toThrow(NotFoundException);
  });

  it('odbija zahtev korisnika koji nije učesnik razgovora', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);

    await expect(service.draftReply('c1', {}, 'staff-bez-pristupa')).rejects.toThrow(ForbiddenException);
  });

  it('vraća napomenu bez poziva Anthropic-a kad nema prepiske', async () => {
    const { service, prisma, anthropic } = makeService();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
    prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
    prisma.message.findMany.mockResolvedValue([]);

    const result = await service.draftReply('c1', {}, 'staff-1');

    expect(result.draft).toBeNull();
    expect(anthropic.isConfigured).not.toHaveBeenCalled();
  });

  it('gracefully degradira kad ANTHROPIC_API_KEY nije podešen (isti obrazac kao OmnisearchService)', async () => {
    const { service, prisma, anthropic } = makeService();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
    prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
    prisma.message.findMany.mockResolvedValue([{ senderId: 'contact-1', body: 'Da li imate slobodne sobe?' }]);
    anthropic.isConfigured.mockReturnValue(false);

    const result = await service.draftReply('c1', {}, 'staff-1');

    expect(result.draft).toBeNull();
    expect(result.note).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('nikad ne poziva message.send / ne upisuje Message — vraća isključivo tekst nacrta', async () => {
    const { service, prisma, anthropic, invocationLog } = makeService();
    prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
    prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
    prisma.message.findMany.mockResolvedValue([{ senderId: 'contact-1', body: 'Da li imate slobodne sobe za avgust?' }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'contact-1', fullName: 'Dobavljač Hotel' }]);
    prisma.aIAgent.findFirst.mockResolvedValue({ id: 'agent-1', userId: 'agent-user-1', modelTier: 'LIGHT' });
    anthropic.isConfigured.mockReturnValue(true);
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Poštovani, imamo slobodne sobe...' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    anthropic.getClient.mockReturnValue({ messages: { create } });

    const result = await service.draftReply('c1', {}, 'staff-1');

    expect(result.draft).toBe('Poštovani, imamo slobodne sobe...');
    expect(invocationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1', actionCode: 'supplier_draft.generate', securityCritical: false }),
    );
    // Ovaj servis nema nijednu Prisma metodu koja piše u Message — jedini "izlaz" je vraćen tekst.
    expect((prisma as any).message.create).toBeUndefined();
  });
});
