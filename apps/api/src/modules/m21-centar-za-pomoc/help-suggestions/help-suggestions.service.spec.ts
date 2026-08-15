import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HelpSuggestionsService } from './help-suggestions.service';

// M21 spec §5.4/§7/§8 — grupisanje ponovljenih NONE/LOW/negativnih pitanja u AI predlog (prag
// 3+, poglavlje 8 "podešava se empirijski"), i dvoslojno odobrenje (APPROVE predloga ≠ objava
// članka — kreirani HelpArticle ostaje PENDING_APPROVAL, čeka sopstveni korak objavljivanja).
describe('HelpSuggestionsService (M21 spec §5.4/§7)', () => {
  function makeService() {
    const prisma = {
      helpQuestion: { findMany: jest.fn(), findUnique: jest.fn() },
      helpArticleSuggestion: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      helpArticle: { create: jest.fn(), findUnique: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const anthropic = { isConfigured: jest.fn().mockReturnValue(false), getClient: jest.fn() };
    const invocationLog = { record: jest.fn() };
    const service = new HelpSuggestionsService(prisma as any, auditLog as any, permissions as any, anthropic as any, invocationLog as any);
    return { service, prisma, auditLog, permissions, anthropic, invocationLog };
  }

  function question(id: string, overrides: Partial<Record<string, any>> = {}) {
    return {
      id,
      askedBy: 'staff-1',
      audienceContext: 'STAFF',
      questionText: 'Kako se obrađuje delimičan povraćaj novca za rezervaciju?',
      answerText: null,
      matchedArticleIds: [],
      confidence: 'NONE',
      wasHelpful: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it('3+ slična pitanja (preklapanje reči) na istu temu generišu jedan HelpArticleSuggestion', async () => {
    const { service, prisma } = makeService();
    prisma.helpQuestion.findMany.mockResolvedValue([
      question('q1'),
      question('q2', { questionText: 'Kako obraditi delimičan povraćaj kod rezervacije?' }),
      question('q3', { questionText: 'Postupak za delimičan povraćaj novca rezervacije' }),
    ]);
    prisma.helpArticleSuggestion.create.mockResolvedValue({ id: 's1' });

    const created = await service.generateSuggestions();

    expect(created).toBe(1);
    expect(prisma.helpArticleSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ basedOnQuestionIds: expect.arrayContaining(['q1', 'q2', 'q3']), status: 'PENDING_APPROVAL' }),
      }),
    );
  });

  it('manje od 3 slična pitanja NE generišu predlog', async () => {
    const { service, prisma } = makeService();
    prisma.helpQuestion.findMany.mockResolvedValue([
      question('q1'),
      question('q2', { questionText: 'Kako obraditi delimičan povraćaj kod rezervacije?' }),
    ]);

    const created = await service.generateSuggestions();

    expect(created).toBe(0);
    expect(prisma.helpArticleSuggestion.create).not.toHaveBeenCalled();
  });

  it('pitanja iz različitih audience_context grupa se ne mešaju', async () => {
    const { service, prisma } = makeService();
    prisma.helpQuestion.findMany.mockResolvedValue([
      question('q1', { audienceContext: 'STAFF' }),
      question('q2', { audienceContext: 'SUBAGENT', questionText: 'Kako obraditi delimičan povraćaj kod rezervacije?' }),
      question('q3', { audienceContext: 'SUBAGENT', questionText: 'Postupak za delimičan povraćaj novca rezervacije' }),
    ]);

    const created = await service.generateSuggestions();

    // SUBAGENT grupa ima samo 2 (q2, q3 se grupišu, q1 STAFF ostaje sam) — ispod praga 3.
    expect(created).toBe(0);
  });

  it('review(APPROVE) kreira HelpArticle u statusu PENDING_APPROVAL (NE PUBLISHED) — dva odvojena koraka odobrenja', async () => {
    const { service, prisma } = makeService();
    prisma.helpArticleSuggestion.findUnique.mockResolvedValue({
      id: 's1',
      basedOnQuestionIds: ['q1', 'q2', 'q3'],
      draftTitle: 'Delimičan povraćaj',
      draftBody: 'Uputstvo...',
      status: 'PENDING_APPROVAL',
    });
    prisma.helpQuestion.findUnique.mockResolvedValue({ id: 'q1', audienceContext: 'STAFF' });
    prisma.helpArticle.create.mockResolvedValue({ id: 'article-1', status: 'PENDING_APPROVAL' });
    prisma.helpArticleSuggestion.update.mockResolvedValue({ id: 's1', status: 'APPROVED' });

    const result = await service.review('s1', 'APPROVE', 'hr-1');

    expect(prisma.helpArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_APPROVAL', generatedBy: 'AI' }) }),
    );
    expect(result.createdArticle?.status).toBe('PENDING_APPROVAL');
    expect(result.suggestion.status).toBe('APPROVED');
  });

  it('review(REJECT) ne kreira HelpArticle', async () => {
    const { service, prisma } = makeService();
    prisma.helpArticleSuggestion.findUnique.mockResolvedValue({ id: 's1', status: 'PENDING_APPROVAL', basedOnQuestionIds: [] });
    prisma.helpArticleSuggestion.update.mockResolvedValue({ id: 's1', status: 'REJECTED' });

    const result = await service.review('s1', 'REJECT', 'hr-1');

    expect(prisma.helpArticle.create).not.toHaveBeenCalled();
    expect(result.createdArticle).toBeNull();
  });

  it('review() bez M21/suggestion/APPROVE dozvole baca ForbiddenException', async () => {
    const { service, prisma, permissions } = makeService();
    prisma.helpArticleSuggestion.findUnique.mockResolvedValue({ id: 's1', status: 'PENDING_APPROVAL', basedOnQuestionIds: [] });
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.review('s1', 'APPROVE', 'neko-bez-prava')).rejects.toThrow(ForbiddenException);
  });

  it('review() na već rešen predlog baca BadRequestException', async () => {
    const { service, prisma } = makeService();
    prisma.helpArticleSuggestion.findUnique.mockResolvedValue({ id: 's1', status: 'APPROVED', basedOnQuestionIds: [] });

    await expect(service.review('s1', 'APPROVE', 'hr-1')).rejects.toThrow(BadRequestException);
  });
});
