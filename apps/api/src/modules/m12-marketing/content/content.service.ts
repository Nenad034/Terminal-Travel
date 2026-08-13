import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentChannel, ContentPieceStatus, ContentPieceType, LanguageCode, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpsertContentTranslationDto } from './dto/upsert-content-translation.dto';
import { generateTrackingCode } from './tracking-code';
import { hasAiTransparencyMarker } from './ai-transparency-check';
import { DistributionService } from '../distribution/distribution.service';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';
const SLUG_REQUIRED_TYPES: ContentPieceType[] = ['STATIC_PAGE', 'BLOG_POST'];
const MAX_TRACKING_CODE_ATTEMPTS = 10;

function resolveContentTranslation<T extends { languageCode: LanguageCode }>(
  translations: T[],
  requestedLang: LanguageCode = DEFAULT_LANGUAGE,
): T | null {
  const byLang = (lang: LanguageCode) => translations.find((t) => t.languageCode === lang) ?? null;
  return byLang(requestedLang) ?? byLang('en') ?? byLang('sr') ?? null;
}

// M12 spec §2/§3/§3b/§3c/§7 — ContentPiece CRUD + tok odobrenja/objave. Svaka izmena upisuje
// audit trag (M1 spec §3.8, isti obrazac kao M2/M4/M6/M10/... servisi) — audit log NIJE
// opciono u ovom kodu, već univerzalno pravilo za sve upisne operacije preko celog repoa.
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly distribution: DistributionService,
  ) {}

  private async createUniqueTrackingCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_TRACKING_CODE_ATTEMPTS; attempt++) {
      const code = generateTrackingCode();
      const existing = await this.prisma.contentPiece.findUnique({ where: { trackingCode: code } });
      if (!existing) return code;
    }
    // Statistički zanemarljivo (33^8 prostor) — čuva kod od tihog pada u retkom slučaju kolizije.
    throw new Error('Nije moguće generisati jedinstven tracking_code posle više pokušaja.');
  }

  private assertSlugRule(type: ContentPieceType, slug: string | undefined | null): void {
    if (SLUG_REQUIRED_TYPES.includes(type) && !slug) {
      throw new BadRequestException(`slug je obavezan za tip ${type} (M12 spec §2.1/§3b).`);
    }
  }

  // §8 izlazni kriterijum — "STATIC_PAGE/BLOG_POST sa istim slug se ne može kreirati dvaput".
  // Eksplicitna provera pre upisa (umesto da se osloni na "gutanje" Prisma P2002 grešaka —
  // PrismaExceptionFilter namerno propušta sve osim P2025, isti princip kao svaki drugi *OrThrow
  // poziv u repou) daje čist 409 sa razumljivom porukom umesto neuhvaćenog 500.
  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.contentPiece.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`slug "${slug}" je već zauzet (M12 spec §8 — slug jedinstvenost).`);
    }
  }

  // ==========================================================================
  // Kreiranje — POST /content (ljudski unos, uvek DRAFT/HUMAN — M12 spec §3)
  // ==========================================================================
  async create(dto: CreateContentDto, actorId: string) {
    this.assertSlugRule(dto.type, dto.slug);
    if (dto.slug) await this.assertSlugAvailable(dto.slug);

    const trackingCode = await this.createUniqueTrackingCode();
    const content = await this.prisma.contentPiece.create({
      data: {
        productId: dto.productId ?? null,
        type: dto.type,
        slug: dto.slug ?? null,
        trackingCode,
        targetChannels: dto.targetChannels,
        targetTags: (dto.targetTags ?? null) as Prisma.InputJsonValue,
        containsAiGeneratedMedia: dto.containsAiGeneratedMedia ?? false,
        scheduledPublishAt: dto.scheduledPublishAt ? new Date(dto.scheduledPublishAt) : null,
        status: 'DRAFT',
        generatedBy: 'HUMAN',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'content.created',
      resourceType: 'ContentPiece',
      resourceId: content.id,
      afterState: content,
      context: {},
    });
    return content;
  }

  // M12 spec §3, korak 2 — poziva ga isključivo M12EventSubscribersService na product.published,
  // nikad ljudski unos preko API-ja (zato AI_AGENT aktor, ne HUMAN — isti obrazac kao ostali
  // "Autonomno" AI koraci drugde u repou).
  async createAiDraft(params: {
    productId: string;
    title: string;
    body: string;
    languageCode: LanguageCode;
    type?: ContentPieceType;
    targetChannels?: ContentChannel[];
  }) {
    const trackingCode = await this.createUniqueTrackingCode();
    const content = await this.prisma.contentPiece.create({
      data: {
        productId: params.productId,
        type: params.type ?? 'SOCIAL_POST',
        trackingCode,
        targetChannels: params.targetChannels ?? ['M8_SITE', 'FACEBOOK', 'INSTAGRAM'],
        status: 'PENDING_APPROVAL',
        generatedBy: 'AI',
        translations: {
          create: {
            languageCode: params.languageCode,
            title: params.title,
            body: params.body,
            translationSource: 'AI_GENERATED',
            isReviewed: false,
          },
        },
      },
      include: { translations: true },
    });
    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: null,
      module: 'M12',
      action: 'content.ai_draft_created',
      resourceType: 'ContentPiece',
      resourceId: content.id,
      afterState: content,
      context: { trigger: 'product.published', productId: params.productId },
    });
    return content;
  }

  // ==========================================================================
  // Čitanje
  // ==========================================================================
  // M12 spec §7 — GET /content: "lista (kalendar = sortirano po scheduled_publish_at)".
  async findAll(filters: { type?: ContentPieceType; status?: ContentPieceStatus; channel?: ContentChannel; slug?: string }) {
    return this.prisma.contentPiece.findMany({
      where: {
        type: filters.type,
        status: filters.status,
        targetChannels: filters.channel ? { has: filters.channel } : undefined,
        slug: filters.slug,
      },
      include: { translations: true },
      orderBy: [{ scheduledPublishAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const content = await this.prisma.contentPiece.findUnique({ where: { id }, include: { translations: true } });
    if (!content) throw new NotFoundException(`ContentPiece ${id} nije pronađen.`);
    return content;
  }

  // §7 — priprema za M8 rute /stranica/:slug i /blog/:slug (§3b) kad M8 frontend dobije kod;
  // već sad korisno za GET /content?slug=... preko findAll iznad.
  async findBySlug(slug: string) {
    const content = await this.prisma.contentPiece.findUnique({ where: { slug }, include: { translations: true } });
    if (!content) throw new NotFoundException(`ContentPiece sa slug=${slug} nije pronađen.`);
    return content;
  }

  /** M13 fact-sync — razrešava Booking.referral_tracking_code ka nazivu sadržaja (§3a). */
  async findByTrackingCode(trackingCode: string): Promise<{ id: string; name: string } | null> {
    const content = await this.prisma.contentPiece.findUnique({
      where: { trackingCode },
      include: { translations: true },
    });
    if (!content) return null;
    const translation = resolveContentTranslation(content.translations, DEFAULT_LANGUAGE);
    return { id: content.id, name: translation?.title ?? content.slug ?? content.trackingCode };
  }

  // ==========================================================================
  // Izmena — PATCH /content/:id
  // ==========================================================================
  async update(id: string, dto: UpdateContentDto, actorId: string) {
    const before = await this.findOne(id);
    if (before.status === 'PUBLISHED') {
      throw new BadRequestException('Objavljen sadržaj se više ne može menjati (M12 spec §3, nepovratna granica).');
    }
    if (before.status === 'APPROVED') {
      throw new BadRequestException(
        'Odobren sadržaj se ne može menjati preko ovog endpoint-a (M12 spec §3, nepovratna granica ka javnoj objavi).',
      );
    }

    const effectiveSlug = dto.slug !== undefined ? dto.slug : before.slug;
    this.assertSlugRule(before.type, effectiveSlug ?? undefined);
    if (dto.slug && dto.slug !== before.slug) await this.assertSlugAvailable(dto.slug, id);

    const after = await this.prisma.contentPiece.update({
      where: { id },
      data: {
        slug: dto.slug !== undefined ? dto.slug : undefined,
        targetChannels: dto.targetChannels,
        targetTags: dto.targetTags !== undefined ? ((dto.targetTags ?? null) as Prisma.InputJsonValue) : undefined,
        containsAiGeneratedMedia: dto.containsAiGeneratedMedia,
        scheduledPublishAt: dto.scheduledPublishAt !== undefined ? new Date(dto.scheduledPublishAt) : undefined,
      },
      include: { translations: true },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'content.updated',
      resourceType: 'ContentPiece',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // ==========================================================================
  // Odobrenje — POST /content/:id/approve (M12 spec §3 korak 4, nepovratna granica)
  // ==========================================================================
  async approve(id: string, actorId: string) {
    const content = await this.findOne(id);
    if (content.status !== 'DRAFT' && content.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Sadržaj u statusu ${content.status} se ne može (ponovo) odobriti (M12 spec §3).`);
    }
    if (content.translations.length === 0) {
      throw new BadRequestException('ContentPiece nema nijedan prevod — nema šta da se odobri.');
    }

    if (content.containsAiGeneratedMedia) {
      // §3c, pravilo 2 — sintetički AI vizual ne sme zameniti stvarni prikaz KONKRETNOG proizvoda.
      // Mehanička proksi-provera za taj uređivački zahtev: BANNER vezan za konkretan product_id je
      // upravo slučaj koji spec navodi kao rizičan (banner tipično prikazuje stvarni smeštaj/uslugu),
      // dok su SOCIAL_POST/BLOG_POST/EMAIL_NEWSLETTER vezani za proizvod pretežno tekstualni/najavni
      // sadržaj (nizak rizik zamene stvarne fotografije) — izbor dokumentovan ovde po zahtevu spec-a
      // ("na tebi je, dokumentuj izbor u kodu").
      if (content.productId && content.type === 'BANNER') {
        throw new BadRequestException(
          'AI-generisan sintetički vizual (contains_ai_generated_media=true) se ne sme koristiti kao BANNER vezan za konkretan proizvod — rizik dovođenja gosta u zabludu o stvarnom izgledu usluge (M12 spec §3c).',
        );
      }
      if (!hasAiTransparencyMarker(content.translations.map((t) => t.body).join(' '))) {
        throw new BadRequestException(
          'contains_ai_generated_media=true zahteva vidljivu oznaku transparentnosti (npr. "generisano uz pomoć veštačke inteligencije") u telu bar jednog prevoda pre odobrenja (M12 spec §3c).',
        );
      }
    }

    const approved = await this.prisma.contentPiece.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actorId },
      include: { translations: true },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'content.approved',
      resourceType: 'ContentPiece',
      resourceId: id,
      beforeState: content,
      afterState: approved,
      context: {},
    });

    // §3 korak 5 — kad nema zakazanog termina (ili je već prošao), objava je mehaničko izvršenje
    // već odobrene radnje, ne nova AI/ljudska odluka — izvršava se odmah umesto da čeka cron.
    if (!approved.scheduledPublishAt || approved.scheduledPublishAt <= new Date()) {
      return this.publish(approved.id);
    }
    return approved;
  }

  // ==========================================================================
  // Objava — poziva ga approve() (bez zakazivanja) i ContentPublishSchedulerService (cron, §3 korak 5)
  // ==========================================================================
  async publish(id: string) {
    const content = await this.prisma.contentPiece.findUnique({ where: { id }, include: { translations: true } });
    if (!content) throw new NotFoundException(`ContentPiece ${id} nije pronađen.`);
    if (content.status === 'PUBLISHED') return content; // idempotentno — cron sme da ponovo pokuša

    if (content.status !== 'APPROVED') {
      throw new BadRequestException(`Samo APPROVED sadržaj se može objaviti (trenutni status: ${content.status}).`);
    }

    await this.distribution.publish(content);

    const published = await this.prisma.contentPiece.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { translations: true },
    });
    await this.auditLog.write({
      actorType: 'SYSTEM',
      actorId: null,
      module: 'M12',
      action: 'content.published',
      resourceType: 'ContentPiece',
      resourceId: id,
      beforeState: content,
      afterState: published,
      context: {},
    });
    return published;
  }

  // Cron ulazna tačka (§3 korak 5) — sve APPROVED čiji je scheduled_publish_at dospeo.
  async publishDueContent(): Promise<number> {
    const due = await this.prisma.contentPiece.findMany({
      where: { status: 'APPROVED', scheduledPublishAt: { lte: new Date() } },
    });
    for (const item of due) {
      await this.publish(item.id);
    }
    return due.length;
  }

  // ==========================================================================
  // Prevodi — GET/PUT /content/:id/translations (isti obrazac kao M2)
  // ==========================================================================
  async listTranslations(contentPieceId: string) {
    await this.findOne(contentPieceId);
    return this.prisma.contentTranslation.findMany({
      where: { contentPieceId },
      orderBy: { languageCode: 'asc' },
    });
  }

  async upsertTranslation(contentPieceId: string, dto: UpsertContentTranslationDto, actorId: string) {
    await this.findOne(contentPieceId);
    const translation = await this.prisma.contentTranslation.upsert({
      where: { contentPieceId_languageCode: { contentPieceId, languageCode: dto.languageCode } },
      create: {
        contentPieceId,
        languageCode: dto.languageCode,
        title: dto.title,
        body: dto.body,
        translationSource: dto.translationSource ?? 'MANUAL',
        isReviewed: dto.isReviewed ?? true,
      },
      update: {
        title: dto.title,
        body: dto.body,
        translationSource: dto.translationSource ?? 'MANUAL',
        isReviewed: dto.isReviewed ?? true,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'content.translation_upserted',
      resourceType: 'ContentTranslation',
      resourceId: translation.id,
      afterState: translation,
      context: { contentPieceId },
    });
    return translation;
  }
}
