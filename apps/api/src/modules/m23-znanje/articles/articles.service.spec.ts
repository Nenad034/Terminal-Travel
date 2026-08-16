import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ArticlesService } from './articles.service';

// M23 spec §6/§9 — publish() nikad AI_AGENT (provereno na nivou koda), generiše share_token
// SAMO pri prvom prelasku u PUBLISHED.
describe('ArticlesService.publish (M23 spec §6/§9)', () => {
  function makeService() {
    const prisma = {
      article: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      articleTranslation: { upsert: jest.fn() },
      aIAgent: { findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const research = { researchFromProvidedText: jest.fn() };
    const service = new ArticlesService(prisma as any, auditLog as any, research as any);
    return { service, prisma, auditLog };
  }

  it('odbija publish ako actorId pripada AI_AGENT nalogu', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue({ id: 'agent-1', userId: 'ai-user-1' });

    await expect(service.publish('a1', 'ai-user-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('odbija publish ako članak nema nijedan prevod', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.article.findUnique.mockResolvedValue({ id: 'a1', translations: [], shareToken: null, publishedAt: null });

    await expect(service.publish('a1', 'human-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generiše share_token pri prvom objavljivanju i ne menja ga pri ponovnom pozivu', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.article.findUnique.mockResolvedValue({
      id: 'a1',
      translations: [{ id: 't1', languageCode: 'sr' }],
      shareToken: null,
      publishedAt: null,
    });
    prisma.article.update.mockImplementation(({ data }: any) => ({ id: 'a1', ...data }));

    const first = await service.publish('a1', 'human-1');
    expect(first.shareToken).toBeDefined();
    expect(typeof first.shareToken).toBe('string');

    // Drugi poziv — članak već ima share_token, ne sme se promeniti.
    prisma.article.findUnique.mockResolvedValue({
      id: 'a1',
      translations: [{ id: 't1', languageCode: 'sr' }],
      shareToken: 'existing-token',
      publishedAt: new Date('2026-01-01'),
    });
    const second = await service.publish('a1', 'human-1');
    expect(second.shareToken).toBe('existing-token');
  });
});
