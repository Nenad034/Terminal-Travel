import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArticleRevision, ArticleRevisionTrigger, ArticleSourceType, ImportFieldType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { ProductContentImportsService } from '../../m2-katalog-proizvoda/product-content-imports/product-content-imports.service';
import { CreateImportDto } from '../../m2-katalog-proizvoda/product-content-imports/dto/create-import.dto';

export interface ResearchFromTextParams {
  articleId: string;
  sourceUrl: string;
  sourceType: ArticleSourceType;
  rawText: string;
  trigger: ArticleRevisionTrigger;
  // Nedostatak 3 (M17 Faza 7) — kad je prosleđen, popunjava POSTOJEĆU PENDING_REVIEW reviziju
  // (npr. prazan SCHEDULED_REFRESH placeholder koji KnowledgeRefreshService kreira) umesto da
  // pravi novu. `trigger` se u tom slučaju ignoriše — revizija zadržava sopstveni trigger.
  revisionId?: string;
}

// Heuristička ekstrakcija AMENITY reči — v1 bez žive pretrage (potvrđeno sa vlasnikom, M23 spec
// §10 poslednja stavka), radi deterministički nad tekstom koji je zaposleni već nalepio. Dovoljno
// konzervativno da bude testabilno (izlazni kriterijum §9), dorađuje se ako AI provajder postane
// dostupan za bogatiju ekstrakciju.
const AMENITY_KEYWORDS: { keyword: RegExp; label: string }[] = [
  { keyword: /wi-?fi|internet/i, label: 'Wi-Fi' },
  { keyword: /bazen|pool/i, label: 'Bazen' },
  { keyword: /parking/i, label: 'Parking' },
  { keyword: /spa|wellness/i, label: 'Spa / Wellness' },
  { keyword: /doručak|breakfast/i, label: 'Doručak' },
  { keyword: /klima|air.?condition/i, label: 'Klima uređaj' },
  { keyword: /plaža|beach/i, label: 'Plaža' },
  { keyword: /teretana|gym|fitness/i, label: 'Teretana' },
];

const NO_STRUCTURE_MARKER = 'NEMA_STRUKTURE';

@Injectable()
export class KnowledgeResearchService {
  private readonly logger = new Logger(KnowledgeResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
    private readonly productContentImports: ProductContentImportsService,
  ) {}

  // M23 spec §4 — AI istraživanje NAD tekstom koji je zaposleni ručno dostavio (nema žive
  // web pretrage/scraping-a u v1, potvrđeno sa vlasnikom). Strukturira rawText u
  // proposed_translations, predlaže ArticleSource(CANDIDATE) za dostavljeni URL/tip, priprema
  // ArticleRevision(PENDING_REVIEW). Za subject_type=PRODUCT dodatno prosleđuje ekstrahovana
  // polja u M2 ProductContentImport (§4d).
  async researchFromProvidedText(params: ResearchFromTextParams, actorId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: params.articleId } });
    if (!article) throw new NotFoundException(`Article ${params.articleId} nije pronađen.`);

    // Nedostatak 3 (M17 Faza 7) — ako je revisionId prosleđen, mora biti PENDING_REVIEW revizija
    // OVOG članka (npr. SCHEDULED_REFRESH placeholder); nikad ne dozvoljava popunjavanje tuđe ili
    // već odlučene (APPROVED/REJECTED) revizije.
    let existingRevision: ArticleRevision | null = null;
    if (params.revisionId) {
      existingRevision = await this.prisma.articleRevision.findUnique({ where: { id: params.revisionId } });
      if (!existingRevision || existingRevision.articleId !== article.id) {
        throw new NotFoundException(`ArticleRevision ${params.revisionId} nije pronađena za članak ${article.id}.`);
      }
      if (existingRevision.status !== 'PENDING_REVIEW') {
        throw new BadRequestException(`Revizija je već ${existingRevision.status} — ne može se ponovo popuniti (M23 spec §4c).`);
      }
    }

    const source = await this.prisma.articleSource.create({
      data: {
        articleId: article.id,
        url: params.sourceUrl,
        sourceType: params.sourceType,
        status: 'CANDIDATE',
      },
    });

    const structured = await this.structureText(params.rawText);

    const proposedTranslations = [
      { languageCode: 'en', title: structured.title, body: structured.body, translationSource: 'AI_GENERATED' },
    ];

    // Status ostaje PENDING_REVIEW u oba slučaja — popunjavanje placeholder revizije nikad ne
    // menja status mimo PENDING_REVIEW (izlazni kriterijum, ista provera kao create put).
    const revision = existingRevision
      ? await this.prisma.articleRevision.update({
          where: { id: existingRevision.id },
          data: {
            proposedTranslations,
            sourceIds: Array.from(new Set([...existingRevision.sourceIds, source.id])),
          },
        })
      : await this.prisma.articleRevision.create({
          data: {
            articleId: article.id,
            trigger: params.trigger,
            proposedTranslations,
            sourceIds: [source.id],
            status: 'PENDING_REVIEW',
          },
        });

    const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'KNOWLEDGE_AGENT' } });
    if (structured.usedAnthropic && agent) {
      // §7 — model_tier predlog STANDARD za sintezu (složeniji zadatak od čistog pretraživanja).
      await this.invocationLog.record({
        agentId: agent.id,
        actionCode: 'knowledge_article.research_draft',
        requestedTier: 'STANDARD',
        securityCritical: false,
        modelIdentifier: AnthropicClientService.MODEL,
        inputTokens: structured.inputTokens,
        outputTokens: structured.outputTokens,
        latencyMs: structured.latencyMs,
      });
    }

    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agent?.userId ?? null,
      module: 'M23',
      action: 'knowledge_article.research_draft',
      resourceType: 'ArticleRevision',
      resourceId: revision.id,
      afterState: { articleId: article.id, sourceId: source.id, trigger: params.trigger },
      context: { requestedBy: actorId },
    });

    // §4d — most ka M2 kataloga, samo za subject_type=PRODUCT.
    if (article.subjectType === 'PRODUCT' && article.productId) {
      await this.bridgeToProductCatalog(article.productId, params.rawText, revision.id, actorId);
    }

    return { source, revision };
  }

  private async structureText(
    rawText: string,
  ): Promise<{ title: string; body: string; usedAnthropic: boolean; inputTokens: number; outputTokens: number; latencyMs: number }> {
    if (this.anthropic.isConfigured()) {
      try {
        return await this.structureWithAnthropic(rawText);
      } catch (err) {
        this.logger.warn(`Anthropic poziv nije uspeo, koristim heuristiku: ${(err as Error).message}`);
      }
    }
    return { ...heuristicStructure(rawText), usedAnthropic: false, inputTokens: 0, outputTokens: 0, latencyMs: 0 };
  }

  private async structureWithAnthropic(
    rawText: string,
  ): Promise<{ title: string; body: string; usedAnthropic: boolean; inputTokens: number; outputTokens: number; latencyMs: number }> {
    const client = this.anthropic.getClient();
    const systemPrompt =
      'Ti si KnowledgeAgent za bazu znanja agencije Terminal Travel. Dobijaš sirov tekst koji je zaposleni kopirao ' +
      'sa zvaničnog sajta/društvene mreže hotela ili turističke organizacije. Strukturiraj ga u kratak, koristan ' +
      'članak — JEDAN naslov (do 100 karaktera) i sažet, praktičan opis u markdown-u (do 400 reči), ISKLJUČIVO na ' +
      'osnovu prosleđenog teksta, ništa iz opšteg znanja. Odgovori TAČNO u formatu:\nNASLOV: <naslov>\nOPIS:\n<opis>\n' +
      `Ako prosleđen tekst ne sadrži dovoljno podataka da se struktuira, odgovori TAČNO sa "${NO_STRUCTURE_MARKER}".`;

    const startedAt = Date.now();
    const response = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: rawText }],
    });
    const latencyMs = Date.now() - startedAt;
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    const rawResponse = textBlock?.text?.trim() ?? '';

    if (!rawResponse || rawResponse.includes(NO_STRUCTURE_MARKER)) {
      const fallback = heuristicStructure(rawText);
      return { ...fallback, usedAnthropic: true, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, latencyMs };
    }

    const titleMatch = rawResponse.match(/NASLOV:\s*(.+)/);
    const bodyMatch = rawResponse.match(/OPIS:\s*([\s\S]+)/);
    const fallback = heuristicStructure(rawText);
    return {
      title: titleMatch?.[1]?.trim() || fallback.title,
      body: bodyMatch?.[1]?.trim() || fallback.body,
      usedAnthropic: true,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    };
  }

  // §4d — ekstrahuje polja koja odgovaraju M2 ImportFieldType taksonomiji i prosleđuje ih preko
  // već postojećeg M2 mehanizma. V1 (bez žive pretrage/AI provajdera obavezno) uvek predlaže
  // DESCRIPTION (ceo strukturiran tekst) + heuristički pronađene AMENITY stavke — dovoljno za
  // izlazni kriterijum §9 ("subject_type=PRODUCT sa poklapajućim poljima ispravno kreira
  // ProductContentImport"), dorađuje se ROOM_TYPE/PHOTO/LOCATION/SERVICE ekstrakcija kad AI
  // provajder bude dostupan za bogatiju strukturiranu ekstrakciju.
  private async bridgeToProductCatalog(productId: string, rawText: string, revisionId: string, actorId: string) {
    const structured = heuristicStructure(rawText);
    const fields: { fieldType: ImportFieldType; extractedValue: Record<string, unknown>; sourceArticleRevisionId: string }[] = [
      { fieldType: 'DESCRIPTION', extractedValue: { value: structured.body }, sourceArticleRevisionId: revisionId },
    ];
    for (const { keyword, label } of AMENITY_KEYWORDS) {
      if (keyword.test(rawText)) {
        fields.push({ fieldType: 'AMENITY', extractedValue: { value: label }, sourceArticleRevisionId: revisionId });
      }
    }

    const importDto: CreateImportDto = { productId, origin: 'M23_RESEARCH', fields };
    await this.productContentImports.create(importDto, actorId);
  }
}

function heuristicStructure(rawText: string): { title: string; body: string } {
  const trimmed = rawText.trim();
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  const title = (firstLine || trimmed.slice(0, 80)).slice(0, 100) || 'Bez naslova';
  return { title, body: trimmed };
}
