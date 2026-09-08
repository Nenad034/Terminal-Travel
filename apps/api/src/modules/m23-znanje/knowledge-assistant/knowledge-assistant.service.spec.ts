import { ForbiddenException } from '@nestjs/common';
import { KnowledgeAssistantService } from './knowledge-assistant.service';

// M23 spec §3.2/§3.3/§9 — /ask odgovara isključivo iz PUBLISHED sadržaja, jezički fallback
// traženi->en->sr, confidence=NONE nudi pokretanje istraživanja (offerResearch).
//
// Nalaz 3.5 (dok. 39, 7.9.2026) — RAG mehanika (embedding/keyword selekcija, Anthropic poziv) je
// izdvojena u `AssistantEngineService` i testirana JEDNOM tamo (`assistant-engine.service.spec.ts`),
// zajedničku za M21 i M23. Ovaj fajl mokuje `engine.resolveAnswer` i testira SAMO ono što je i
// dalje ekskluzivno M23: učitavanje kandidata bez audience filtera, jezički fallback,
// AgentInvocationLog grananje i "zahtev za istraživanje".
describe('KnowledgeAssistantService (M23 spec §3.2/§3.3/§9)', () => {
  function makeService() {
    const prisma = {
      article: { findMany: jest.fn() },
      question: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const engine = {
      resolveAnswer: jest.fn().mockResolvedValue({
        answerText: null,
        matchedArticleIds: [],
        confidence: 'NONE',
        usedAnthropic: false,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      }),
    };
    const invocationLog = { record: jest.fn() };
    const agencySettings = {
      getSanitizedBrandName: jest.fn().mockResolvedValue('Terminal Travel'),
    };
    const service = new KnowledgeAssistantService(
      prisma as any,
      auditLog as any,
      engine as any,
      invocationLog as any,
      agencySettings as any,
    );
    return { service, prisma, auditLog, engine, invocationLog, agencySettings };
  }

  it('vraća confidence=NONE i offerResearch=true kad nema objavljenih članaka', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.question.create.mockResolvedValue({
      id: 'q1',
      answerText: null,
      matchedArticleIds: [],
      confidence: 'NONE',
    });
    prisma.aIAgent.findFirst.mockResolvedValue(null);

    const result = await service.ask({ question: 'Kakvo je vreme na Bahamima?' }, 'staff-1');

    expect(result.confidence).toBe('NONE');
    expect(result.offerResearch).toBe(true);
  });

  it('učitava SAMO status=PUBLISHED, bez audience filtera (za razliku od M21)', async () => {
    const { service, prisma } = makeService();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.question.create.mockResolvedValue({
      id: 'q1',
      answerText: null,
      matchedArticleIds: [],
      confidence: 'NONE',
    });

    await service.ask({ question: 'Pitanje' }, 'staff-1');

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PUBLISHED' }, include: { translations: true } }),
    );
  });

  it('jezički fallback: traži lang=de, nema de prevoda, pada na en (§3.2 lanac traženi→en→sr)', async () => {
    const { service, prisma, engine } = makeService();
    prisma.article.findMany.mockResolvedValue([
      {
        id: 'a1',
        translations: [
          {
            id: 't1-en',
            languageCode: 'en',
            title: 'Hotel wifi parking pool amenities',
            body: 'wifi parking pool amenities available here',
          },
          {
            id: 't1-sr',
            languageCode: 'sr',
            title: 'Hotel wifi parking bazen',
            body: 'wifi parking bazen dostupno ovde',
          },
        ],
      },
    ]);
    prisma.question.create.mockImplementation(({ data }: any) => ({ id: 'q1', ...data }));

    await service.ask(
      { question: 'Da li hotel ima wifi parking pool amenities', lang: 'de' as any },
      'staff-1',
    );

    // "de" ne postoji -> pada na "en" (ne "sr", koji je sledeći u lancu tek ako ni "en" ne postoji).
    expect(engine.resolveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            translationId: 't1-en',
            title: 'Hotel wifi parking pool amenities',
          }),
        ],
      }),
    );
  });

  it('prosleđuje engine-u ispravnu tabelu za embedding (article_translations, za razliku od M21)', async () => {
    const { service, prisma, engine } = makeService();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.question.create.mockResolvedValue({
      id: 'q1',
      answerText: null,
      matchedArticleIds: [],
      confidence: 'NONE',
    });

    await service.ask({ question: 'Pitanje' }, 'staff-1');

    expect(engine.resolveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ embeddingTable: 'article_translations' }),
    );
  });

  it('kad engine javi usedAnthropic=true, upisuje AgentInvocationLog', async () => {
    const { service, prisma, engine, invocationLog } = makeService();
    prisma.article.findMany.mockResolvedValue([]);
    engine.resolveAnswer.mockResolvedValue({
      answerText: 'Ostrvo ima peščane plaže.',
      matchedArticleIds: ['a1'],
      confidence: 'HIGH',
      usedAnthropic: true,
      inputTokens: 100,
      outputTokens: 20,
      latencyMs: 150,
    });
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent-1',
      userId: 'agent-user-1',
      modelTier: 'LIGHT',
    });
    prisma.question.create.mockImplementation(({ data }: any) => ({ id: 'q1', ...data }));

    const result = await service.ask({ question: 'Kakve su plaže?' }, 'staff-1');

    expect(result.confidence).toBe('HIGH');
    expect(invocationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1', actionCode: 'knowledge_question.answer' }),
    );
  });

  it('kad engine javi usedAnthropic=false, NE upisuje AgentInvocationLog', async () => {
    const { service, prisma, invocationLog } = makeService();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.question.create.mockImplementation(({ data }: any) => ({ id: 'q1', ...data }));

    await service.ask({ question: 'Pitanje' }, 'staff-1');

    expect(invocationLog.record).not.toHaveBeenCalled();
  });

  it('requestResearch odbija ako pitanje nije confidence=NONE', async () => {
    const { service, prisma } = makeService();
    prisma.question.findUnique.mockResolvedValue({
      id: 'q1',
      askedBy: 'staff-1',
      confidence: 'HIGH',
    });

    await expect(service.requestResearch('q1', 'staff-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requestResearch prihvata zahtev i upisuje audit trag kad je confidence=NONE i pitanje pripada pozivaocu', async () => {
    const { service, prisma, auditLog } = makeService();
    prisma.question.findUnique.mockResolvedValue({
      id: 'q1',
      askedBy: 'staff-1',
      confidence: 'NONE',
      questionText: 'X?',
    });

    const result = await service.requestResearch('q1', 'staff-1');

    expect(result.question.id).toBe('q1');
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'question.research_requested' }),
    );
  });

  it('requestResearch odbija ako pozivalac nije autor pitanja', async () => {
    const { service, prisma } = makeService();
    prisma.question.findUnique.mockResolvedValue({
      id: 'q1',
      askedBy: 'neko-drugi',
      confidence: 'NONE',
    });

    await expect(service.requestResearch('q1', 'staff-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
