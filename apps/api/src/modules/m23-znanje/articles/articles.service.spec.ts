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
    prisma.article.findUnique.mockResolvedValue({
      id: 'a1',
      translations: [],
      shareToken: null,
      publishedAt: null,
    });

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

describe('ArticlesService.findAll — straničenje + filteri na serveru (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      article: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const auditLog = { write: jest.fn() };
    const research = {};
    const service = new ArticlesService(prisma, auditLog as any, research as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([{ id: 'a1', translations: [] }]);
    prisma.article.count.mockResolvedValue(1);

    const result = await service.findAll('actor-1', true);

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 }),
    );
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('ko nema EDIT dobija SAMO PUBLISHED, čak i ako traži drugi status', async () => {
    const { service, prisma } = makeService();

    await service.findAll('actor-1', false, undefined, undefined, {
      status: 'DRAFT' as any,
    });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
  });

  it('ko ima EDIT sme da filtrira po subjectType/status na serveru', async () => {
    const { service, prisma } = makeService();

    await service.findAll('actor-1', true, undefined, undefined, {
      subjectType: 'COUNTRY' as any,
      status: 'DRAFT' as any,
    });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subjectType: 'COUNTRY', status: 'DRAFT' }),
      }),
    );
  });
});
