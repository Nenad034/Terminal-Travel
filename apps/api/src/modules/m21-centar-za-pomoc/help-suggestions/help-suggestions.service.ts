import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HelpQuestion } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';

const GROUPING_WINDOW_DAYS = 30;
// M21 spec §8 — "prag/algoritam grupisanja... određuje se kad postoji stvarna količina pitanja
// da se proceni razumno". Polazna, dokumentovana vrednost (isti "podešava se empirijski" princip
// kao M18 pragovi): 3+ pitanja na istu temu u prozoru od 30 dana.
const SUGGESTION_THRESHOLD = 3;
const MIN_WORD_OVERLAP = 2;

// M21 spec §5.4 — cron detektor koji pretvara ponovljene NONE/LOW/negativne (was_helpful=false)
// odgovore u HelpArticleSuggestion nacrte, AUTONOMOUS (čisto pripremni nacrt, ništa se ne
// objavljuje — spec §5.4). "Ista tema" = ista audience_context publika + (preklapanje
// matched_article_ids KAD postoji, jer NONE pitanja nemaju poklapanja po definiciji) ILI
// preklapanje ≥2 značajne reči u tekstu pitanja — dokumentovan izbor bez ML-a (poglavlje
// "Nalazi istraživanja" u planu implementacije).
@Injectable()
export class HelpSuggestionsService {
  private readonly logger = new Logger(HelpSuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyGrouping(): Promise<number> {
    return this.generateSuggestions();
  }

  async generateSuggestions(): Promise<number> {
    const since = new Date(Date.now() - GROUPING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.helpQuestion.findMany({
      where: {
        createdAt: { gte: since },
        OR: [{ confidence: { in: ['NONE', 'LOW'] } }, { wasHelpful: false }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const existingSuggestions = await this.prisma.helpArticleSuggestion.findMany({ select: { basedOnQuestionIds: true } });
    const alreadyUsed = new Set(existingSuggestions.flatMap((s) => s.basedOnQuestionIds));
    const pool = candidates.filter((q) => !alreadyUsed.has(q.id));

    const groups = groupByTopic(pool);
    let created = 0;
    for (const group of groups) {
      if (group.length < SUGGESTION_THRESHOLD) continue;
      await this.createSuggestionFromGroup(group);
      created++;
    }
    return created;
  }

  private async createSuggestionFromGroup(group: HelpQuestion[]): Promise<void> {
    const basedOnQuestionIds = group.map((q) => q.id);
    const draft = await this.draftFromQuestions(group);

    // §5.4 — AI nacrt ulazi direktno u PENDING_APPROVAL (isti obrazac kao M12
    // ContentService.createAiDraft — "AI nacrt ulazi direktno u PENDING_APPROVAL").
    const suggestion = await this.prisma.helpArticleSuggestion.create({
      data: {
        basedOnQuestionIds,
        draftTitle: draft.title,
        draftBody: draft.body,
        status: 'PENDING_APPROVAL',
      },
    });

    const agentUser = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'HELP_CENTER_AGENT' } });
    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agentUser?.userId ?? null,
      module: 'M21',
      action: 'help_article_suggestion.draft',
      resourceType: 'HelpArticleSuggestion',
      resourceId: suggestion.id,
      afterState: suggestion,
      context: { basedOnQuestionIds },
    });
  }

  private async draftFromQuestions(group: HelpQuestion[]): Promise<{ title: string; body: string }> {
    const questionsList = group.map((q) => `- ${q.questionText}`).join('\n');

    if (!this.anthropic.isConfigured()) {
      return {
        title: `Nedostaje uputstvo: ${group[0].questionText.slice(0, 80)}`,
        body: `Ponovljena pitanja bez dobrog odgovora u bazi znanja (${group.length}):\n\n${questionsList}\n\n(Nacrt čeka ljudsku dopunu — AI odgovor trenutno nije dostupan, ANTHROPIC_API_KEY nije podešen.)`,
      };
    }

    try {
      const client = this.anthropic.getClient();
      const systemPrompt =
        'Ti si HelpCenterAgent za Terminal Travel. Zaposleni/subagenti/klijenti su više puta postavili slična ' +
        'pitanja na koja baza znanja nije imala dobar odgovor. Napiši KRATAK nacrt naslova i tela članka baze ' +
        'znanja (markdown) koji bi odgovorio na ta pitanja — jasno, praktično, na srpskom. Format odgovora: prvi ' +
        'red je naslov (bez markdown # oznake), prazan red, zatim telo.';
      const startedAt = Date.now();
      const response = await client.messages.create({
        model: AnthropicClientService.MODEL,
        max_tokens: 768,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Ponovljena pitanja:\n${questionsList}` }],
      });
      const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
      const raw = textBlock?.text?.trim() ?? '';
      const [firstLine, ...rest] = raw.split('\n');

      const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'HELP_CENTER_AGENT' } });
      if (agent) {
        await this.invocationLog.record({
          agentId: agent.id,
          actionCode: 'help_article_suggestion.draft',
          requestedTier: agent.modelTier ?? 'LIGHT',
          securityCritical: false,
          modelIdentifier: AnthropicClientService.MODEL,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          latencyMs: Date.now() - startedAt,
        });
      }

      return {
        title: firstLine?.trim() || `Nedostaje uputstvo: ${group[0].questionText.slice(0, 80)}`,
        body: rest.join('\n').trim() || questionsList,
      };
    } catch (err) {
      this.logger.warn(`Anthropic poziv nije uspeo, koristi se prost template: ${(err as Error).message}`);
      return {
        title: `Nedostaje uputstvo: ${group[0].questionText.slice(0, 80)}`,
        body: `Ponovljena pitanja bez dobrog odgovora u bazi znanja (${group.length}):\n\n${questionsList}`,
      };
    }
  }

  // ==========================================================================
  // GET /help/suggestions, PATCH /help/suggestions/:id
  // ==========================================================================
  async findPending() {
    return this.prisma.helpArticleSuggestion.findMany({ where: { status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'desc' } });
  }

  async review(id: string, decision: 'APPROVE' | 'REJECT', actorId: string) {
    const suggestion = await this.prisma.helpArticleSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException(`HelpArticleSuggestion ${id} nije pronađen.`);
    if (suggestion.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Predlog u statusu ${suggestion.status} se ne može ponovo odobriti/odbiti.`);
    }
    if (!(await this.permissions.hasPermission(actorId, 'M21', 'suggestion', 'APPROVE'))) {
      throw new ForbiddenException('Nema M21/suggestion/APPROVE dozvolu.');
    }

    if (decision === 'REJECT') {
      const rejected = await this.prisma.helpArticleSuggestion.update({
        where: { id },
        data: { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() },
      });
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId,
        module: 'M21',
        action: 'help_article_suggestion.rejected',
        resourceType: 'HelpArticleSuggestion',
        resourceId: id,
        beforeState: suggestion,
        afterState: rejected,
        context: {},
      });
      return { suggestion: rejected, createdArticle: null };
    }

    // APPROVE — §2.4/§5.4: kreira stvaran HelpArticle(status=PENDING_APPROVAL), koji I DALJE
    // čeka SOPSTVENI korak objavljivanja (PATCH /help/articles/:id sa PUBLISH dozvolom) — dva
    // odvojena koraka odobrenja, izlazni kriterijum §7 četvrta stavka.
    const slug = await this.buildUniqueSlug(suggestion.draftTitle);
    const firstQuestion = await this.prisma.helpQuestion.findUnique({ where: { id: suggestion.basedOnQuestionIds[0] } });
    const audience = firstQuestion ? [firstQuestion.audienceContext] : ['STAFF' as const];

    const article = await this.prisma.helpArticle.create({
      data: {
        slug,
        audience,
        status: 'PENDING_APPROVAL',
        generatedBy: 'AI',
        translations: { create: { languageCode: 'sr', title: suggestion.draftTitle, body: suggestion.draftBody } },
      },
    });

    const approved = await this.prisma.helpArticleSuggestion.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date() },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M21',
      action: 'help_article_suggestion.approved',
      resourceType: 'HelpArticleSuggestion',
      resourceId: id,
      beforeState: suggestion,
      afterState: approved,
      context: { createdArticleId: article.id },
    });

    return { suggestion: approved, createdArticle: article };
  }

  private async buildUniqueSlug(title: string): Promise<string> {
    const base = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'predlog-clanka';

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt}`;
      const existing = await this.prisma.helpArticle.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Nije moguće generisati jedinstven slug za predlog članka.');
  }
}

function significantWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w, i, arr) => arr.indexOf(w) === i);
}

function groupByTopic(pool: HelpQuestion[]): HelpQuestion[][] {
  const used = new Set<string>();
  const groups: HelpQuestion[][] = [];

  for (const q of pool) {
    if (used.has(q.id)) continue;
    const group = [q];
    used.add(q.id);
    const qWords = significantWords(q.questionText);

    for (const other of pool) {
      if (used.has(other.id) || other.audienceContext !== q.audienceContext) continue;
      const sharesArticle = q.matchedArticleIds.some((id) => other.matchedArticleIds.includes(id));
      const overlapWords = significantWords(other.questionText).filter((w) => qWords.includes(w)).length;
      if (sharesArticle || overlapWords >= MIN_WORD_OVERLAP) {
        group.push(other);
        used.add(other.id);
      }
    }
    groups.push(group);
  }
  return groups;
}
