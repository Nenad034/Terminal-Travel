import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ArticleTranslation, LanguageCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { assertHumanActor } from '../ai-agent-guard';
import { KnowledgeResearchService } from '../knowledge-research/knowledge-research.service';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

// Isti obrazac kao M21 HelpArticlesService.resolveHelpTranslation/M12 ContentService — svaki
// modul sa prevodima drži sopstvenu kopiju (CLAUDE.md — moduli pristupaju jedni drugima preko
// API-ja, nema deljenog paketa za ovu malu čistu funkciju).
function resolveArticleTranslation<T extends { languageCode: LanguageCode }>(
  translations: T[],
  requestedLang: LanguageCode = DEFAULT_LANGUAGE,
): T | null {
  const byLang = (lang: LanguageCode) => translations.find((t) => t.languageCode === lang) ?? null;
  return byLang(requestedLang) ?? byLang('en') ?? byLang('sr') ?? null;
}

// M23 spec §2.1/§3.1/§8 — CRUD nad Article/ArticleTranslation. Za razliku od M21, nema `audience`
// segmentaciju (§3.1 — isti sadržaj za interni tim i subagente) — vidljivost je samo
// EDIT-vs-VIEW (uređivač vidi sve statuse, ostali samo PUBLISHED), sprovedeno na nivou
// dozvole u kontroleru (@RequirePermission), ne po payload-u kao M21.
@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly research: KnowledgeResearchService,
  ) {}

  async create(dto: CreateArticleDto, actorId: string) {
    if (dto.subjectType === 'PRODUCT' && !dto.productId) {
      throw new BadRequestException('subject_type=PRODUCT zahteva product_id (M23 spec §2.1).');
    }
    if ((dto.subjectType === 'DESTINATION' || dto.subjectType === 'COUNTRY') && !dto.destinationCountry) {
      throw new BadRequestException('subject_type=DESTINATION/COUNTRY zahteva destination_country (M23 spec §2.1).');
    }

    const article = await this.prisma.article.create({
      data: {
        subjectType: dto.subjectType,
        productId: dto.subjectType === 'PRODUCT' ? dto.productId : null,
        destinationCountry: dto.subjectType === 'PRODUCT' ? null : dto.destinationCountry,
        destinationCity: dto.subjectType === 'DESTINATION' ? dto.destinationCity : null,
        status: 'DRAFT',
        generatedBy: dto.research ? 'AI' : 'HUMAN',
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article.created',
      resourceType: 'Article',
      resourceId: article.id,
      afterState: article,
      context: {},
    });

    // Ručan unos — M23 spec §8, "ili ručan unos ako telo sadrži gotov tekst".
    if (dto.translations?.length) {
      for (const t of dto.translations) {
        await this.prisma.articleTranslation.upsert({
          where: { articleId_languageCode: { articleId: article.id, languageCode: t.languageCode } },
          create: {
            articleId: article.id,
            languageCode: t.languageCode,
            title: t.title,
            body: t.body,
            translationSource: t.translationSource ?? 'MANUAL',
          },
          update: { title: t.title, body: t.body, translationSource: t.translationSource ?? 'MANUAL' },
        });
      }
    }

    // AI istraživanje — M23 spec §4/§8, "pokreće AI istraživanje (ArticleRevision,
    // trigger=INITIAL_CREATION)". Servisni sloj (ne kontroler) da ArticlesService ostane jedina
    // tačka ulaza koju POST /articles poziva — isti in-process DI obrazac kao M13/M19/M21.
    if (dto.research) {
      await this.research.researchFromProvidedText(
        {
          articleId: article.id,
          sourceUrl: dto.research.sourceUrl,
          sourceType: dto.research.sourceType,
          rawText: dto.research.rawText,
          trigger: 'INITIAL_CREATION',
        },
        actorId,
      );
    }

    return this.findOne(article.id, actorId, true);
  }

  async findAll(actorId: string, canSeeAllStatuses: boolean, lang?: LanguageCode) {
    const articles = await this.prisma.article.findMany({
      where: canSeeAllStatuses ? {} : { status: 'PUBLISHED' },
      include: { translations: true },
      orderBy: { createdAt: 'desc' },
    });
    return articles.map((a) => this.withResolvedTranslation(a, lang));
  }

  async findOne(id: string, actorId: string, canSeeAllStatuses: boolean, lang?: LanguageCode) {
    const article = await this.prisma.article.findUnique({ where: { id }, include: { translations: true } });
    if (!article) throw new NotFoundException(`Article ${id} nije pronađen.`);
    if (!canSeeAllStatuses && article.status !== 'PUBLISHED') {
      throw new NotFoundException(`Article ${id} nije pronađen.`);
    }
    return this.withResolvedTranslation(article, lang);
  }

  async update(id: string, dto: UpdateArticleDto, actorId: string) {
    const before = await this.prisma.article.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Article ${id} nije pronađen.`);

    const after = await this.prisma.article.update({
      where: { id },
      data: {
        status: dto.status,
        destinationCountry: dto.destinationCountry !== undefined ? dto.destinationCountry : undefined,
        destinationCity: dto.destinationCity !== undefined ? dto.destinationCity : undefined,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article.updated',
      resourceType: 'Article',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // M23 spec §6/§9 — POST /articles/:id/publish. Nikad AI_AGENT (provereno na nivou koda, ne
  // samo dozvole), generiše share_token pri PRVOM prelasku u PUBLISHED (poglavlje 5 — isti token
  // ostaje važeći posle svake naredne odobrene revizije).
  async publish(id: string, actorId: string) {
    await assertHumanActor(this.prisma, actorId, 'Objava članka (M23/article/PUBLISH)');

    const before = await this.prisma.article.findUnique({ where: { id }, include: { translations: true } });
    if (!before) throw new NotFoundException(`Article ${id} nije pronađen.`);
    if (before.translations.length === 0) {
      throw new BadRequestException('Članak nema nijedan prevod — nema šta da se objavi (M23 spec §2.1).');
    }

    const after = await this.prisma.article.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        approvedBy: actorId,
        publishedAt: before.publishedAt ?? new Date(),
        shareToken: before.shareToken ?? randomUUID(),
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article.published',
      resourceType: 'Article',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  private withResolvedTranslation<T extends { translations: ArticleTranslation[] }>(article: T, lang: LanguageCode | undefined) {
    const { translations, ...rest } = article as any;
    return { ...rest, translation: resolveArticleTranslation(translations, lang), translations };
  }
}
