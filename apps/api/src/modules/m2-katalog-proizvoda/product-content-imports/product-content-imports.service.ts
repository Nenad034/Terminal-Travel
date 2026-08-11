import { BadRequestException, Injectable } from '@nestjs/common';
import { ImportFieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateImportDto } from './dto/create-import.dto';
import { ReviewFieldDto } from './dto/review-field.dto';

// M2 spec §3.3 — "izvučen tekst ... se tretira kao jedan jezik (obično engleski)".
const EXTRACTION_LANGUAGE = 'en' as const;

@Injectable()
export class ProductContentImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.productContentImport.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.productContentImport.findUniqueOrThrow({
      where: { id },
      include: { fields: true },
    });
  }

  // M2 spec §3.3/§3.3a.
  async create(dto: CreateImportDto, actorId: string) {
    const origin = dto.origin ?? 'MANUAL_URL';

    if (origin === 'M23_RESEARCH') {
      if (!dto.productId) {
        throw new BadRequestException('M23_RESEARCH uvoz zahteva product_id (M2 spec §3.3a)');
      }
      const importRecord = await this.prisma.productContentImport.create({
        data: {
          productId: dto.productId,
          origin: 'M23_RESEARCH',
          status: 'EXTRACTED', // §3.3a — ekstrakcija već urađena u M23, preskače PENDING
          extractedAt: new Date(),
          createdBy: actorId,
          fields: {
            create: (dto.fields ?? []).map((f) => ({
              fieldType: f.fieldType,
              extractedValue: f.extractedValue as unknown as Prisma.InputJsonValue,
              matchConfidence: f.matchConfidence,
              sourceArticleRevisionId: f.sourceArticleRevisionId,
            })),
          },
        },
        include: { fields: true },
      });
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId,
        module: 'M2',
        action: 'product_content_import.created',
        resourceType: 'ProductContentImport',
        resourceId: importRecord.id,
        afterState: { origin, status: importRecord.status, fieldCount: importRecord.fields.length },
        context: {},
      });
      return importRecord;
    }

    // MANUAL_URL — M2 spec §3.3, korak 1: "Zaposleni kreira ProductContentImport sa
    // source_url ... status = PENDING". Stvarna ekstrakcija (korak 2, "AI agent učitava
    // stranicu") zahteva odluku o AI provajderu koja još nije doneta (vidi CLAUDE.md —
    // ne izmišljati tehnički detalj eksterne integracije) — zato uvoz ostaje FAILED sa
    // jasnim razlogom umesto lažnog uspeha, isti obrazac kao TODO za slanje email-a u M1.
    if (!dto.sourceUrl) {
      throw new BadRequestException('MANUAL_URL uvoz zahteva source_url (M2 spec §3.3)');
    }
    const importRecord = await this.prisma.productContentImport.create({
      data: {
        productId: dto.productId,
        sourceUrl: dto.sourceUrl,
        origin: 'MANUAL_URL',
        status: 'FAILED',
        failureReason:
          'AI ekstrakcija sadržaja sa sajta hotela nije još povezana — čeka odluku o AI provajderu (M2 spec §3.3, korak 2).',
        createdBy: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product_content_import.created',
      resourceType: 'ProductContentImport',
      resourceId: importRecord.id,
      afterState: { origin, status: importRecord.status },
      context: {},
    });
    return importRecord;
  }

  // M2 spec §3.3, korak 3-4 — ljudski pregled; primena u katalog samo posle reviewedBy.
  async reviewField(importId: string, fieldId: string, dto: ReviewFieldDto, actorId: string) {
    const field = await this.prisma.productContentImportField.findUniqueOrThrow({
      where: { id: fieldId },
      include: { import: true },
    });
    if (field.import.id !== importId) {
      throw new BadRequestException('Stavka ne pripada navedenom uvozu');
    }

    if (dto.decision === 'REJECTED') {
      const rejected = await this.prisma.productContentImportField.update({
        where: { id: fieldId },
        data: { reviewStatus: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() },
      });
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId,
        module: 'M2',
        action: 'product_content_import_field.rejected',
        resourceType: 'ProductContentImportField',
        resourceId: fieldId,
        context: { importId },
      });
      await this.maybeComplete(importId);
      return rejected;
    }

    const valueToApply =
      dto.decision === 'EDITED_AND_APPROVED' ? (dto.editedValue as Record<string, unknown>) : (field.extractedValue as Record<string, unknown>);

    let productId = field.import.productId;
    if (!productId) {
      // §3.3 — "prazno ako se uvoz koristi da kreira novi proizvod". Prvo odobreno
      // polje materijalizuje proizvod (v1 obim: samo ACCOMMODATION, §3.3).
      const created = await this.prisma.product.create({
        data: {
          type: 'ACCOMMODATION',
          sourceType: 'CONTRACTED',
          status: 'DRAFT',
          cacheStatus: 'N_A',
          destinationCountry: '',
          destinationCity: '',
          createdBy: actorId,
        },
      });
      productId = created.id;
      await this.prisma.productContentImport.update({ where: { id: importId }, data: { productId } });
    }

    await this.applyFieldValue(productId, field.fieldType, valueToApply);

    const applied = await this.prisma.productContentImportField.update({
      where: { id: fieldId },
      data: {
        reviewStatus: dto.decision,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        appliedAt: new Date(),
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product_content_import_field.approved',
      resourceType: 'ProductContentImportField',
      resourceId: fieldId,
      afterState: { decision: dto.decision, fieldType: field.fieldType },
      context: { importId, productId },
    });

    await this.maybeComplete(importId);
    return applied;
  }

  private async applyFieldValue(productId: string, fieldType: ImportFieldType, value: Record<string, unknown>) {
    switch (fieldType) {
      case 'NAME':
      case 'DESCRIPTION': {
        const existing = await this.prisma.productTranslation.findUnique({
          where: { productId_languageCode: { productId, languageCode: EXTRACTION_LANGUAGE } },
        });
        const text = String(value.value ?? '');
        await this.prisma.productTranslation.upsert({
          where: { productId_languageCode: { productId, languageCode: EXTRACTION_LANGUAGE } },
          create: {
            productId,
            languageCode: EXTRACTION_LANGUAGE,
            name: fieldType === 'NAME' ? text : (existing?.name ?? ''),
            description: fieldType === 'DESCRIPTION' ? text : (existing?.description ?? ''),
            slug: `product-${productId}`,
            translationSource: 'AI_GENERATED',
            isReviewed: true, // upravo je pregledano (§3.3, korak 4)
          },
          update: {
            name: fieldType === 'NAME' ? text : undefined,
            description: fieldType === 'DESCRIPTION' ? text : undefined,
            translationSource: 'AI_GENERATED',
            isReviewed: true,
          },
        });
        return;
      }
      case 'AMENITY':
      case 'SERVICE': {
        // §3.3, korak 4 — AMENITY/SERVICE oba idu u attributes.amenities[] (§9 otvoreno pitanje o razdvajanju).
        const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
        const attrs = (product.attributes ?? {}) as { amenities?: string[] };
        const amenities = [...(attrs.amenities ?? []), String(value.value ?? '')];
        await this.prisma.product.update({
          where: { id: productId },
          data: { attributes: { ...attrs, amenities } as unknown as Prisma.InputJsonValue },
        });
        return;
      }
      case 'ROOM_TYPE': {
        const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
        const attrs = (product.attributes ?? {}) as { room_types?: Record<string, unknown>[] };
        const roomTypes = [...(attrs.room_types ?? []), value];
        await this.prisma.product.update({
          where: { id: productId },
          data: { attributes: { ...attrs, room_types: roomTypes } as unknown as Prisma.InputJsonValue },
        });
        return;
      }
      case 'PHOTO': {
        const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
        const media = Array.isArray(product.media) ? (product.media as Record<string, unknown>[]) : [];
        const newItem = {
          url: value.url,
          type: value.type ?? 'image',
          order: media.length,
          category: value.category ?? 'DRUGO',
          room_type_code: value.room_type_code ?? null,
          caption: value.caption ?? null,
          source: 'AI_IMPORTED',
        };
        await this.prisma.product.update({
          where: { id: productId },
          data: { media: [...media, newItem] as unknown as Prisma.InputJsonValue },
        });
        return;
      }
      case 'LOCATION': {
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            destinationCountry: (value.country as string) ?? undefined,
            destinationCity: (value.city as string) ?? undefined,
            geoLat: value.lat !== undefined ? (value.lat as number) : undefined,
            geoLng: value.lng !== undefined ? (value.lng as number) : undefined,
          },
        });
        return;
      }
    }
  }

  private async maybeComplete(importId: string) {
    const pending = await this.prisma.productContentImportField.count({
      where: { importId, reviewStatus: 'PENDING' },
    });
    if (pending === 0) {
      await this.prisma.productContentImport.update({ where: { id: importId }, data: { status: 'COMPLETED' } });
    } else {
      await this.prisma.productContentImport.update({ where: { id: importId }, data: { status: 'REVIEW_IN_PROGRESS' } });
    }
  }
}
