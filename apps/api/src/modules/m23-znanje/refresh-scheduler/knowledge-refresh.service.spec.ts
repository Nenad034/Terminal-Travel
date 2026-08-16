import { KnowledgeRefreshService } from './knowledge-refresh.service';

// M23 spec §4c/§9 — dospeo rok kreira ArticleRevision(SCHEDULED_REFRESH, PENDING_REVIEW) BEZ
// ijedne izmene na živom, objavljenom sadržaju; ne dupliraj ako već postoji PENDING_REVIEW
// SCHEDULED_REFRESH revizija za isti članak.
describe('KnowledgeRefreshService.runDueRefreshes (M23 spec §4c/§9)', () => {
  function makeService() {
    const prisma = {
      article: { findMany: jest.fn(), update: jest.fn() },
      articleRevision: { findFirst: jest.fn(), create: jest.fn() },
      articleSource: { findMany: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new KnowledgeRefreshService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('kreira PENDING_REVIEW SCHEDULED_REFRESH reviziju za dospeo članak, bez diranja Article', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([{ id: 'a1', status: 'PUBLISHED', nextRefreshDueAt: new Date('2020-01-01') }]);
    prisma.articleRevision.findFirst.mockResolvedValue(null);
    prisma.articleSource.findMany.mockResolvedValue([{ id: 's1', status: 'APPROVED' }]);
    prisma.articleRevision.create.mockResolvedValue({ id: 'r1', articleId: 'a1', status: 'PENDING_REVIEW', trigger: 'SCHEDULED_REFRESH' });
    prisma.aIAgent.findFirst.mockResolvedValue({ userId: 'agent-user-1' });

    const count = await service.runDueRefreshes();

    expect(count).toBe(1);
    expect(prisma.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ articleId: 'a1', trigger: 'SCHEDULED_REFRESH', status: 'PENDING_REVIEW', sourceIds: ['s1'] }),
      }),
    );
    // Kritično — nijedna izmena na Article dok revizija čeka.
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('preskače članak ako već postoji PENDING_REVIEW SCHEDULED_REFRESH revizija (izbegava dupliranje)', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([{ id: 'a1', status: 'PUBLISHED', nextRefreshDueAt: new Date('2020-01-01') }]);
    prisma.articleRevision.findFirst.mockResolvedValue({ id: 'existing-r1' });

    const count = await service.runDueRefreshes();

    expect(count).toBe(0);
    expect(prisma.articleRevision.create).not.toHaveBeenCalled();
  });

  it('ne dira članke čiji rok nije dospeo (filtrirano već u upitu — provera da servis ne radi ništa dodatno)', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([]);

    const count = await service.runDueRefreshes();

    expect(count).toBe(0);
    expect(prisma.articleRevision.create).not.toHaveBeenCalled();
  });
});
