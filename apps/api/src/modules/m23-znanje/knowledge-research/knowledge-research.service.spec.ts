import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnowledgeResearchService } from './knowledge-research.service';

// M23 spec §4/§4d/§9 — izlazni kriterijum: istraživanje za subject_type=PRODUCT sa poklapajućim
// poljima ispravno kreira M2 ProductContentImport (origin=M23_RESEARCH) sa
// source_article_revision_id popunjenim na svakom polju.
describe('KnowledgeResearchService.researchFromProvidedText (M23 spec §4/§4d/§9)', () => {
  function makeService() {
    const prisma = {
      article: { findUnique: jest.fn() },
      articleSource: { create: jest.fn() },
      articleRevision: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const anthropic = { isConfigured: jest.fn().mockReturnValue(false), getClient: jest.fn() };
    const invocationLog = { record: jest.fn() };
    const productContentImports = { create: jest.fn() };
    const service = new KnowledgeResearchService(
      prisma as any,
      auditLog as any,
      anthropic as any,
      invocationLog as any,
      productContentImports as any,
    );
    return { service, prisma, auditLog, anthropic, invocationLog, productContentImports };
  }

  it('kreira ArticleSource(CANDIDATE) i ArticleRevision(PENDING_REVIEW) iz dostavljenog teksta', async () => {
    const { service, prisma } = makeService();
    prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'DESTINATION', productId: null });
    prisma.articleSource.create.mockResolvedValue({ id: 's1', articleId: 'a1', status: 'CANDIDATE' });
    prisma.articleRevision.create.mockResolvedValue({ id: 'r1', articleId: 'a1', status: 'PENDING_REVIEW' });
    prisma.aIAgent.findFirst.mockResolvedValue({ userId: 'agent-user-1' });

    const result = await service.researchFromProvidedText(
      {
        articleId: 'a1',
        sourceUrl: 'https://example-tourism-board.gov',
        sourceType: 'GOVERNMENT_OR_TOURISM_BOARD',
        rawText: 'Ovo je opis destinacije X. Poznata po plažama.',
        trigger: 'INITIAL_CREATION',
      },
      'human-1',
    );

    expect(prisma.articleSource.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ articleId: 'a1', status: 'CANDIDATE' }) }),
    );
    expect(prisma.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ articleId: 'a1', trigger: 'INITIAL_CREATION', status: 'PENDING_REVIEW' }) }),
    );
    expect(result.source.id).toBe('s1');
    expect(result.revision.id).toBe('r1');
  });

  it('subject_type=PRODUCT kreira M2 ProductContentImport sa sourceArticleRevisionId popunjenim na svakom polju', async () => {
    const { service, prisma, productContentImports } = makeService();
    prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'PRODUCT', productId: 'prod-1' });
    prisma.articleSource.create.mockResolvedValue({ id: 's1', articleId: 'a1', status: 'CANDIDATE' });
    prisma.articleRevision.create.mockResolvedValue({ id: 'r1', articleId: 'a1', status: 'PENDING_REVIEW' });
    prisma.aIAgent.findFirst.mockResolvedValue({ userId: 'agent-user-1' });

    await service.researchFromProvidedText(
      {
        articleId: 'a1',
        sourceUrl: 'https://hotel-x.example.com',
        sourceType: 'HOTEL_OFFICIAL_WEBSITE',
        rawText: 'Hotel X ima besplatan Wi-Fi, bazen i parking. Doručak je uključen.',
        trigger: 'INITIAL_CREATION',
      },
      'human-1',
    );

    expect(productContentImports.create).toHaveBeenCalledTimes(1);
    const [importDto] = productContentImports.create.mock.calls[0];
    expect(importDto.productId).toBe('prod-1');
    expect(importDto.origin).toBe('M23_RESEARCH');
    expect(importDto.fields.length).toBeGreaterThan(1); // DESCRIPTION + bar jedan AMENITY (Wi-Fi/bazen/parking/doručak)
    for (const field of importDto.fields) {
      expect(field.sourceArticleRevisionId).toBe('r1');
    }
    expect(importDto.fields.some((f: any) => f.fieldType === 'DESCRIPTION')).toBe(true);
    expect(importDto.fields.some((f: any) => f.fieldType === 'AMENITY')).toBe(true);
  });

  it('subject_type=DESTINATION/COUNTRY NIKAD ne poziva M2 most (nema product_id)', async () => {
    const { service, prisma, productContentImports } = makeService();
    prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'COUNTRY', productId: null });
    prisma.articleSource.create.mockResolvedValue({ id: 's1' });
    prisma.articleRevision.create.mockResolvedValue({ id: 'r1' });
    prisma.aIAgent.findFirst.mockResolvedValue(null);

    await service.researchFromProvidedText(
      { articleId: 'a1', sourceUrl: 'https://gov.example', sourceType: 'GOVERNMENT_OR_TOURISM_BOARD', rawText: 'Tekst o zemlji.', trigger: 'INITIAL_CREATION' },
      'human-1',
    );

    expect(productContentImports.create).not.toHaveBeenCalled();
  });

  // Nedostatak 3 (M17 Faza 7, rešeno) — POST /knowledge/articles/:id/research sa i bez revisionId.
  describe('researchFromProvidedText — revisionId (Nedostatak 3)', () => {
    it('bez revisionId pravi novu reviziju (isto ponašanje kao pri kreiranju)', async () => {
      const { service, prisma } = makeService();
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'DESTINATION', productId: null });
      prisma.articleSource.create.mockResolvedValue({ id: 's1' });
      prisma.articleRevision.create.mockResolvedValue({ id: 'r-new', articleId: 'a1', status: 'PENDING_REVIEW' });
      prisma.aIAgent.findFirst.mockResolvedValue(null);

      const result = await service.researchFromProvidedText(
        { articleId: 'a1', sourceUrl: 'https://x.example', sourceType: 'GOVERNMENT_OR_TOURISM_BOARD', rawText: 'Tekst.', trigger: 'QUESTION_GAP' },
        'human-1',
      );

      expect(prisma.articleRevision.findUnique).not.toHaveBeenCalled();
      expect(prisma.articleRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ articleId: 'a1', trigger: 'QUESTION_GAP', status: 'PENDING_REVIEW' }) }),
      );
      expect(prisma.articleRevision.update).not.toHaveBeenCalled();
      expect(result.revision.id).toBe('r-new');
    });

    it('sa revisionId popunjava POSTOJEĆU PENDING_REVIEW reviziju (npr. prazan SCHEDULED_REFRESH placeholder) umesto da pravi novu', async () => {
      const { service, prisma } = makeService();
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'DESTINATION', productId: null });
      prisma.articleRevision.findUnique.mockResolvedValue({
        id: 'r-placeholder',
        articleId: 'a1',
        trigger: 'SCHEDULED_REFRESH',
        status: 'PENDING_REVIEW',
        sourceIds: ['approved-src-1'],
      });
      prisma.articleSource.create.mockResolvedValue({ id: 's-new' });
      prisma.articleRevision.update.mockResolvedValue({
        id: 'r-placeholder',
        articleId: 'a1',
        trigger: 'SCHEDULED_REFRESH',
        status: 'PENDING_REVIEW',
      });
      prisma.aIAgent.findFirst.mockResolvedValue(null);

      const result = await service.researchFromProvidedText(
        {
          articleId: 'a1',
          sourceUrl: 'https://x.example',
          sourceType: 'HOTEL_OFFICIAL_WEBSITE',
          rawText: 'Ažuriran tekst.',
          trigger: 'QUESTION_GAP', // ignorisano kad revisionId postoji
          revisionId: 'r-placeholder',
        },
        'human-1',
      );

      expect(prisma.articleRevision.create).not.toHaveBeenCalled();
      expect(prisma.articleRevision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r-placeholder' },
          data: expect.objectContaining({ sourceIds: ['approved-src-1', 's-new'] }),
        }),
      );
      // Status nikad eksplicitno postavljen mimo PENDING_REVIEW u update pozivu.
      const updateCallData = prisma.articleRevision.update.mock.calls[0][0].data;
      expect(updateCallData.status).toBeUndefined();
      expect(result.revision.id).toBe('r-placeholder');
      expect(result.revision.status).toBe('PENDING_REVIEW');
    });

    it('baca NotFoundException kad revisionId ne pripada članku', async () => {
      const { service, prisma } = makeService();
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'DESTINATION', productId: null });
      prisma.articleRevision.findUnique.mockResolvedValue({ id: 'r-x', articleId: 'DRUGI_CLANAK', status: 'PENDING_REVIEW' });

      await expect(
        service.researchFromProvidedText(
          { articleId: 'a1', sourceUrl: 'https://x.example', sourceType: 'HOTEL_OFFICIAL_WEBSITE', rawText: 'T', trigger: 'QUESTION_GAP', revisionId: 'r-x' },
          'human-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('baca BadRequestException kad revisionId više nije PENDING_REVIEW (npr. već APPROVED)', async () => {
      const { service, prisma } = makeService();
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', subjectType: 'DESTINATION', productId: null });
      prisma.articleRevision.findUnique.mockResolvedValue({ id: 'r-x', articleId: 'a1', status: 'APPROVED' });

      await expect(
        service.researchFromProvidedText(
          { articleId: 'a1', sourceUrl: 'https://x.example', sourceType: 'HOTEL_OFFICIAL_WEBSITE', rawText: 'T', trigger: 'QUESTION_GAP', revisionId: 'r-x' },
          'human-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
