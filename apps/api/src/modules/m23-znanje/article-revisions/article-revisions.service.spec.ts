import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ArticleRevisionsService } from './article-revisions.service';

// M23 spec §2.4/§4c/§9 — izlazni kriterijum: revizija se NE MOŽE odobriti dok bar jedan
// referenciran ArticleSource nije APPROVED; odobrenje upisuje translations i pomera
// next_refresh_due_at; odbijanje NE menja ništa na Article.
describe('ArticleRevisionsService (M23 spec §2.4/§4c/§9)', () => {
  function makeService() {
    const prisma = {
      articleRevision: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      articleSource: { findMany: jest.fn() },
      articleTranslation: { upsert: jest.fn() },
      article: { update: jest.fn() },
      aIAgent: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const auditLog = { write: jest.fn() };
    const service = new ArticleRevisionsService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('approve odbija ako actorId pripada AI_AGENT nalogu', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue({ id: 'agent-1', userId: 'ai-user-1' });

    await expect(service.approve('a1', 'r1', 'ai-user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approve odbija ako bilo koji referenciran ArticleSource nije APPROVED', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.articleRevision.findUnique.mockResolvedValue({
      id: 'r1',
      articleId: 'a1',
      status: 'PENDING_REVIEW',
      sourceIds: ['s1', 's2'],
      proposedTranslations: [],
    });
    prisma.articleSource.findMany.mockResolvedValue([
      { id: 's1', status: 'APPROVED' },
      { id: 's2', status: 'CANDIDATE' }, // nije odobren
    ]);

    await expect(service.approve('a1', 'r1', 'human-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approve upisuje proposed_translations kao ArticleTranslation i pomera next_refresh_due_at kad su svi izvori APPROVED', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    const proposedTranslations = [{ languageCode: 'en', title: 'Hotel X', body: 'Opis...', translationSource: 'AI_GENERATED' }];
    prisma.articleRevision.findUnique.mockResolvedValue({
      id: 'r1',
      articleId: 'a1',
      status: 'PENDING_REVIEW',
      sourceIds: ['s1'],
      proposedTranslations,
    });
    prisma.articleSource.findMany.mockResolvedValue([{ id: 's1', status: 'APPROVED' }]);
    prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
    prisma.articleRevision.update.mockReturnValue({ id: 'r1', status: 'APPROVED' });
    prisma.article.update.mockReturnValue({ id: 'a1' });

    const result = await service.approve('a1', 'r1', 'human-1');

    expect(prisma.articleTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { articleId_languageCode: { articleId: 'a1', languageCode: 'en' } },
        create: expect.objectContaining({ title: 'Hotel X', body: 'Opis...' }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.status).toBe('APPROVED');
  });

  it('reject NE menja Article — samo revision.status/reviewedBy/reviewedAt', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.articleRevision.findUnique.mockResolvedValue({ id: 'r1', articleId: 'a1', status: 'PENDING_REVIEW' });
    prisma.articleRevision.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));

    const result = await service.reject('a1', 'r1', 'human-1');

    expect(result.status).toBe('REJECTED');
    expect(prisma.article.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approve baca BadRequestException ako je revizija već odlučena', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.articleRevision.findUnique.mockResolvedValue({ id: 'r1', articleId: 'a1', status: 'APPROVED' });

    await expect(service.approve('a1', 'r1', 'human-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
