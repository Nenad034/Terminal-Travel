import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArticleSourcesService } from './article-sources.service';

// M23 spec §2.3/§4a/§4b/§9 — sourceType ograda je na nivou Prisma enuma (testirano implicitno
// preko DTO-a/šeme, ne ovde); ovaj test pokriva approve/reject putanju, koja nikad ne sme
// izvršiti AI_AGENT (provereno na nivou koda).
describe('ArticleSourcesService (M23 spec §4b/§9)', () => {
  function makeService() {
    const prisma = {
      article: { findUnique: jest.fn() },
      articleSource: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      aIAgent: { findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new ArticleSourcesService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('approve odbija ako actorId pripada AI_AGENT nalogu', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue({ id: 'agent-1', userId: 'ai-user-1' });

    await expect(service.approve('a1', 's1', 'ai-user-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.articleSource.update).not.toHaveBeenCalled();
  });

  it('approve postavlja status=APPROVED i approved_by/approved_at za ljudski nalog', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.articleSource.findUnique.mockResolvedValue({ id: 's1', articleId: 'a1', status: 'CANDIDATE' });
    prisma.articleSource.update.mockImplementation(({ data }: any) => ({ id: 's1', articleId: 'a1', ...data }));

    const result = await service.approve('a1', 's1', 'human-1');

    expect(result.status).toBe('APPROVED');
    expect(result.approvedBy).toBe('human-1');
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it('approve baca NotFoundException ako izvor ne pripada navedenom članku', async () => {
    const { service, prisma } = makeService();
    prisma.aIAgent.findUnique.mockResolvedValue(null);
    prisma.articleSource.findUnique.mockResolvedValue({ id: 's1', articleId: 'DRUGI_ČLANAK', status: 'CANDIDATE' });

    await expect(service.approve('a1', 's1', 'human-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
