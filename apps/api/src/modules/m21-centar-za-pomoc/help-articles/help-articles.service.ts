import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HelpArticleStatus, HelpArticleTranslation, HelpAudience, LanguageCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { CreateHelpArticleDto } from './dto/create-help-article.dto';
import { UpdateHelpArticleDto } from './dto/update-help-article.dto';
import { UpsertHelpArticleTranslationDto } from './dto/upsert-help-article-translation.dto';
import { audienceToPermissionSegment, resolveHelpAudience } from '../audience-context';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

// M2 spec §2.2 fallback pravilo, isti obrazac kao M12 ContentService.resolveContentTranslation
// (svaki modul sa prevodima drži sopstvenu kopiju ove male čiste funkcije — nema deljenog
// paketa za nju, isti princip kao ostatak repoa, CLAUDE.md "moduli pristupaju jedni drugima
// isključivo preko API-ja").
function resolveHelpTranslation<T extends { languageCode: LanguageCode }>(
  translations: T[],
  requestedLang: LanguageCode = DEFAULT_LANGUAGE,
): T | null {
  const byLang = (lang: LanguageCode) => translations.find((t) => t.languageCode === lang) ?? null;
  return byLang(requestedLang) ?? byLang('en') ?? byLang('sr') ?? null;
}

// M21 spec §2.1/§2.2/§3/§6 — CRUD nad HelpArticle/HelpArticleTranslation. `audience` niz
// određuje vidljivost (poglavlje 3 RBAC tabela) — filtriranje pri čitanju je uvek uživo
// izvedeno iz pozivaoca (resolveHelpAudience), nikad iz parametra koji pozivalac šalje.
@Injectable()
export class HelpArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Baca ForbiddenException ako pozivalac nema `action` dozvolu za BAR JEDAN od audience segmenata. */
  private async assertHasAnySegmentPermission(
    actorId: string,
    audience: ('STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT')[],
    action: 'EDIT' | 'PUBLISH',
  ): Promise<void> {
    for (const a of audience) {
      const segment = audienceToPermissionSegment(a);
      if (await this.permissions.hasPermission(actorId, 'M21', `article:${segment}`, action)) return;
    }
    throw new ForbiddenException(
      `Nema ${action} dozvolu ni za jedan od audience segmenata [${audience.join(', ')}] (M21 spec poglavlje 3).`,
    );
  }

  /** Baca ForbiddenException ako pozivaocu nedostaje `action` dozvola za BILO KOJI od navedenih segmenata. */
  private async assertHasEverySegmentPermission(
    actorId: string,
    audience: ('STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT')[],
    action: 'EDIT' | 'PUBLISH',
  ): Promise<void> {
    for (const a of audience) {
      const segment = audienceToPermissionSegment(a);
      if (!(await this.permissions.hasPermission(actorId, 'M21', `article:${segment}`, action))) {
        throw new ForbiddenException(`Nema ${action} dozvolu za audience segment ${a} (M21 spec poglavlje 3).`);
      }
    }
  }

  // ==========================================================================
  // Kreiranje — POST /help/articles (uvek DRAFT, generated_by=HUMAN)
  // ==========================================================================
  async create(dto: CreateHelpArticleDto, actorId: string) {
    await this.assertHasEverySegmentPermission(actorId, dto.audience, 'EDIT');

    const existing = await this.prisma.helpArticle.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`slug "${dto.slug}" je već zauzet.`);

    const article = await this.prisma.helpArticle.create({
      data: {
        slug: dto.slug,
        audience: dto.audience,
        relatedModule: dto.relatedModule ?? null,
        isCriticalExample: dto.isCriticalExample ?? false,
        status: 'DRAFT',
        generatedBy: 'HUMAN',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M21',
      action: 'help_article.created',
      resourceType: 'HelpArticle',
      resourceId: article.id,
      afterState: article,
      context: {},
    });
    return article;
  }

  // ==========================================================================
  // Čitanje
  // ==========================================================================
  // §6 — GET /help/articles: filtrirano po publici IZVEDENOJ iz pozivaoca (ne po parametru).
  // Pojedinačni (INDIVIDUAL) GUEST i svaki drugi nalog bez rešive publike dobija praznu listu —
  // izlazni kriterijum §7, prva stavka.
  //
  // Nedostatak 1 (M17 Faza 7) — opcioni `status` parametar: kad pozivalac traži status različit
  // od PUBLISHED (DRAFT/PENDING_APPROVAL/ARCHIVED) I ima EDIT dozvolu za bar jedan audience
  // segment, vraća članke tog statusa ograničene na segmente za koje ima EDIT (ne tuđe DRAFT-ove).
  // Bez EDIT dozvole ni za jedan segment, parametar se tiho ignoriše — ponašanje ostaje identično
  // podrazumevanom (samo PUBLISHED, samo izvedena sopstvena publika), bezbedno za AI asistenta
  // koji ovaj parametar nikad ne šalje.
  async findVisibleToCaller(
    actorId: string,
    filters: { relatedModule?: string; isCriticalExample?: boolean; lang?: LanguageCode; status?: HelpArticleStatus },
  ) {
    if (filters.status && filters.status !== 'PUBLISHED') {
      const editableAudiences: HelpAudience[] = [];
      for (const a of ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT'] as HelpAudience[]) {
        if (await this.permissions.hasPermission(actorId, 'M21', `article:${audienceToPermissionSegment(a)}`, 'EDIT')) {
          editableAudiences.push(a);
        }
      }
      if (editableAudiences.length > 0) {
        const articles = await this.prisma.helpArticle.findMany({
          where: {
            status: filters.status,
            audience: { hasSome: editableAudiences },
            relatedModule: filters.relatedModule,
            isCriticalExample: filters.isCriticalExample,
          },
          include: { translations: true },
          orderBy: [{ isCriticalExample: 'desc' }, { createdAt: 'desc' }],
        });
        return articles.map((a) => this.withResolvedTranslation(a, filters.lang));
      }
      // nema EDIT ni za jedan segment — pada kroz na podrazumevano ponašanje ispod (negativan test).
    }

    const audience = await resolveHelpAudience(this.prisma, actorId);
    if (!audience) return [];
    // §3 — filtriranje ide kroz M1 Permission zapise, ne samo kroz izvedenu publiku: nalog čija
    // je uloga izgubila M21/article:<segment>/VIEW (npr. UserPermissionOverride DENY) ne vidi
    // ništa, uprkos tome što mu account_type i dalje rešava audience_context.
    if (!(await this.permissions.hasPermission(actorId, 'M21', `article:${audienceToPermissionSegment(audience)}`, 'VIEW'))) {
      return [];
    }

    const articles = await this.prisma.helpArticle.findMany({
      where: {
        status: 'PUBLISHED',
        audience: { has: audience },
        relatedModule: filters.relatedModule,
        isCriticalExample: filters.isCriticalExample,
      },
      include: { translations: true },
      orderBy: [{ isCriticalExample: 'desc' }, { createdAt: 'desc' }],
    });

    return articles.map((a) => this.withResolvedTranslation(a, filters.lang));
  }

  private withResolvedTranslation<T extends { translations: HelpArticleTranslation[] }>(
    article: T,
    lang: LanguageCode | undefined,
  ) {
    const { translations, ...rest } = article as any;
    return { ...rest, translation: resolveHelpTranslation(translations, lang) };
  }

  // §6 — GET /help/articles/:id. Uređivač (EDIT dozvola za bar jedan audience segment) vidi
  // članak u BILO KOM statusu (nacrt uključeno); ostali samo ako je PUBLISHED i publika pozivaoca
  // se poklapa sa audience nizom članka.
  //
  // Nedostatak 1 (M17 Faza 7) — odgovor sada uz postojeće `translation` (rešen fallback, ostaje
  // radi kompatibilnosti sa AI asistentom) uključuje i `translations`: pun niz svih postojećih
  // ArticleTranslation redova za ovaj članak, ista autorizacija kao pre (panel detalj više ne mora
  // da upućuje poziv po jeziku da rekonstruiše listu).
  async findOne(id: string, actorId: string, lang?: LanguageCode) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id }, include: { translations: true } });
    if (!article) throw new NotFoundException(`HelpArticle ${id} nije pronađen.`);

    let canSeeAsEditor = false;
    for (const a of article.audience) {
      if (await this.permissions.hasPermission(actorId, 'M21', `article:${audienceToPermissionSegment(a)}`, 'EDIT')) {
        canSeeAsEditor = true;
        break;
      }
    }
    if (canSeeAsEditor) return { ...this.withResolvedTranslation(article, lang), translations: article.translations };

    if (article.status !== 'PUBLISHED') throw new NotFoundException(`HelpArticle ${id} nije pronađen.`);
    const audience = await resolveHelpAudience(this.prisma, actorId);
    if (!audience || !article.audience.includes(audience)) {
      throw new NotFoundException(`HelpArticle ${id} nije pronađen.`);
    }
    if (!(await this.permissions.hasPermission(actorId, 'M21', `article:${audienceToPermissionSegment(audience)}`, 'VIEW'))) {
      throw new NotFoundException(`HelpArticle ${id} nije pronađen.`);
    }
    return { ...this.withResolvedTranslation(article, lang), translations: article.translations };
  }

  // ==========================================================================
  // Izmena — PATCH /help/articles/:id
  // ==========================================================================
  async update(id: string, dto: UpdateHelpArticleDto, actorId: string) {
    const before = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`HelpArticle ${id} nije pronađen.`);

    // Provera EDIT nad postojećim I (ako se menja) novim audience skupom — sprečava da neko sa
    // EDIT samo za STAFF doda BUSINESS_CLIENT u audience bez odgovarajuće dozvole.
    await this.assertHasEverySegmentPermission(actorId, before.audience, 'EDIT');
    if (dto.audience) await this.assertHasEverySegmentPermission(actorId, dto.audience, 'EDIT');

    const becomesPublished = dto.status === 'PUBLISHED' && before.status !== 'PUBLISHED';
    if (dto.status && dto.status !== before.status) {
      const effectiveAudience = dto.audience ?? before.audience;
      if (dto.status === 'PUBLISHED') {
        // §2.1 — prelazak u PUBLISHED zahteva PUBLISH dozvolu i popunjen approved_by, nikad AI.
        await this.assertHasAnySegmentPermission(actorId, effectiveAudience, 'PUBLISH');
        const withTranslations = await this.prisma.helpArticle.findUnique({ where: { id }, include: { translations: true } });
        if (!withTranslations || withTranslations.translations.length === 0) {
          throw new BadRequestException('Članak nema nijedan prevod — nema šta da se objavi.');
        }
      }
    }

    const after = await this.prisma.helpArticle.update({
      where: { id },
      data: {
        audience: dto.audience,
        relatedModule: dto.relatedModule !== undefined ? dto.relatedModule : undefined,
        isCriticalExample: dto.isCriticalExample,
        status: dto.status,
        approvedBy: becomesPublished ? actorId : undefined,
        publishedAt: becomesPublished ? new Date() : undefined,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M21',
      action: becomesPublished ? 'help_article.published' : 'help_article.updated',
      resourceType: 'HelpArticle',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // ==========================================================================
  // Prevodi — PUT /help/articles/:id/translations (isti obrazac kao M12 ContentService)
  // ==========================================================================
  async upsertTranslation(articleId: string, dto: UpsertHelpArticleTranslationDto, actorId: string) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException(`HelpArticle ${articleId} nije pronađen.`);
    await this.assertHasEverySegmentPermission(actorId, article.audience, 'EDIT');

    const translation = await this.prisma.helpArticleTranslation.upsert({
      where: { helpArticleId_languageCode: { helpArticleId: articleId, languageCode: dto.languageCode as LanguageCode } },
      create: { helpArticleId: articleId, languageCode: dto.languageCode as LanguageCode, title: dto.title, body: dto.body },
      update: { title: dto.title, body: dto.body },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M21',
      action: 'help_article.translation_upserted',
      resourceType: 'HelpArticleTranslation',
      resourceId: translation.id,
      afterState: translation,
      context: { articleId },
    });
    return translation;
  }

  /** Interno — help-assistant/help-suggestions koriste ovo za kandidat-članke po publici. */
  async findPublishedForAudience(audience: 'STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT') {
    return this.prisma.helpArticle.findMany({
      where: { status: 'PUBLISHED', audience: { has: audience } },
      include: { translations: true },
      orderBy: [{ isCriticalExample: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
