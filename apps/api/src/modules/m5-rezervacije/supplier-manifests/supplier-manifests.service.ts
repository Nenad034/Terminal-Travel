import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, SupplierManifestLanguage, SupplierType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { SupplierMailboxService } from '../common/supplier-mailbox.service';
import { nextReferenceCode } from '../common/reference-code';
import { GenerateManifestDto } from './dto/generate-manifest.dto';

/**
 * M5 spec §8 — operativne liste za dobavljače (CONTRACTED stavke). Cena/marža se NIKAD
 * ne uključuje (§8.3, ograda) — ova service namerno ne selektuje base_cost/final_price
 * u payload liste.
 */
@Injectable()
export class SupplierManifestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailbox: SupplierMailboxService,
  ) {}

  // Dopuna 5.9.2026 — ekran u panelu (M17) traži naziv dobavljača i broj stavaka uz svaku listu;
  // bez toga bi spisak bio niz UUID-jeva. Čisto proširenje payload-a već autorizovanog upita
  // (isti obrazac kao M22 v1.5 `mailbox` u `GET /email/threads`), bez nove dozvole.
  findAll(supplierId?: string) {
    return this.prisma.supplierManifest.findMany({
      where: { supplierId },
      orderBy: { generatedAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, contactEmail: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findOne(id: string) {
    const manifest = await this.prisma.supplierManifest.findUnique({
      where: { id },
      include: { items: { include: { bookingItem: { include: { guests: true } } } } },
    });
    if (!manifest) throw new NotFoundException(`SupplierManifest ${id} nije pronađen.`);
    return manifest;
  }

  // §8.4 — priprema DRAFT nacrta agregacijom CONFIRMED CONTRACTED stavki po dobavljaču+periodu.
  // generatedBy može biti "AI_AGENT_M5" (automatska periodična priprema) ili stvaran user id.
  async generateDraft(dto: GenerateManifestDto, generatedBy: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException(`Supplier ${dto.supplierId} nije pronađen.`);

    const periodFrom = new Date(dto.periodFrom);
    const periodTo = new Date(dto.periodTo);

    // Stavke ovog dobavljača (preko product -> sourceContract -> supplierId), CONFIRMED,
    // koje se preklapaju sa traženim periodom, i koje NISU već na nekoj ne-SUPERSEDED listi.
    const candidateItems = await this.prisma.bookingItem.findMany({
      where: {
        sourceType: 'CONTRACTED',
        itemStatus: 'CONFIRMED',
        stayFrom: { lte: periodTo },
        stayTo: { gte: periodFrom },
        ...(dto.contractPeriodId
          ? { rateLine: { contractPeriodId: dto.contractPeriodId } }
          : {}),
        product: { sourceContract: { supplierId: dto.supplierId } },
        manifestEntries: { none: { supplierManifest: { status: { not: 'SUPERSEDED' } } } },
      },
    });

    if (candidateItems.length === 0) {
      throw new BadRequestException('Nema potvrđenih CONTRACTED stavki za ovog dobavljača u traženom periodu.');
    }

    return this.createManifest({
      supplierId: dto.supplierId,
      supplierType: supplier.type,
      contractPeriodId: dto.contractPeriodId ?? null,
      language: dto.language ?? 'SR',
      periodFrom,
      periodTo,
      itemIds: candidateItems.map((item) => item.id),
      generatedBy,
    });
  }

  /**
   * M5 spec §8.4 dopuna (v1.15, na zahtev vlasnika) — "opcija slanja rezervacije pojedinačno
   * dobavljačima": za JEDNU rezervaciju, odmah (ne čekajući periodični posao), pripremi po
   * jedan DRAFT SupplierManifest za svakog dobavljača čije CONTRACTED/CONFIRMED stavke ta
   * rezervacija sadrži — automatski grupisano po dobavljaču (isti princip kao periodično
   * agregiranje iznad, samo obim je jedna rezervacija umesto vremenskog perioda). Slanje
   * ostaje nepromenjeno — ručni klik po listi (POST /supplier-manifests/:id/send).
   */
  async prepareForBooking(bookingId: string, generatedBy: string, language?: SupplierManifestLanguage) {
    return this.prepareGrouped({ bookingId }, generatedBy, language);
  }

  /**
   * M5 spec §8.4 dopuna (v1.16, na zahtev vlasnika) — "checkbox izbor" ILI kombinacija
   * filtera za izveštaj: rezervacija napravljena od-do, boravak preklapa od-do, dolazak
   * pada u od-do, odlazak pada u od-do, status rezervacije. Ista automatska grupacija po
   * dobavljaču kao prepareForBooking iznad. `bookingIds` je poseban, isključiv način
   * (ručni izbor poništava sve ostale filtere ispod — nema mešanja "izaberi ove ID-jeve
   * I još filtriraj po datumu", to bi bilo zbunjujuće); inače mora biti prisutan BAR JEDAN
   * od preostalih filtera — prazan poziv bez ijednog kriterijuma bi zahvatio SVE nenajavljene
   * stavke ikad, što je namerno onemogućeno (previše širok, rizičan podrazumevani obim).
   * Filteri ispod se KOMBINUJU (logičko I) kad je prosleđeno više njih istovremeno.
   * NAMERNO ne postoji ulaz "AI agent, pošalji sam" — ova akcija samo PRIPREMA nacrte
   * (nivo "Autonomno", isto obrazloženje kao periodično agregiranje iznad); slanje ostaje
   * isključivo ljudski klik po listi, bez obzira ko/šta je pripremu pokrenulo (§8.4 —
   * "agent nikad sam ne šalje potvrdu dobavljaču", spec se ovde ne menja).
   */
  async prepareBatch(
    params: {
      bookingIds?: string[];
      createdFrom?: string;
      createdTo?: string;
      stayFrom?: string;
      stayTo?: string;
      arrivalFrom?: string;
      arrivalTo?: string;
      departureFrom?: string;
      departureTo?: string;
      bookingStatus?: BookingStatus | BookingStatus[];
    },
    generatedBy: string,
    language?: SupplierManifestLanguage,
  ) {
    if (params.bookingIds && params.bookingIds.length > 0) {
      return this.prepareGrouped({ bookingId: { in: params.bookingIds } }, generatedBy, language);
    }

    const and: Prisma.BookingItemWhereInput[] = [];

    if (params.createdFrom != null && params.createdTo != null) {
      and.push({ booking: { createdAt: { gte: new Date(params.createdFrom), lte: new Date(params.createdTo) } } });
    }
    // "boravak od-do" — preklapanje opsega (isti obrazac kao periodFrom/periodTo u generateDraft).
    if (params.stayFrom != null && params.stayTo != null) {
      and.push({ stayFrom: { lte: new Date(params.stayTo) }, stayTo: { gte: new Date(params.stayFrom) } });
    }
    // "dolasci od-do" — sam stay_from pada u opseg (kad tačno gost stiže), ne preklapanje.
    if (params.arrivalFrom != null && params.arrivalTo != null) {
      and.push({ stayFrom: { gte: new Date(params.arrivalFrom), lte: new Date(params.arrivalTo) } });
    }
    // "odlasci od-do" — sam stay_to pada u opseg.
    if (params.departureFrom != null && params.departureTo != null) {
      and.push({ stayTo: { gte: new Date(params.departureFrom), lte: new Date(params.departureTo) } });
    }
    if (params.bookingStatus) {
      const statuses = Array.isArray(params.bookingStatus) ? params.bookingStatus : [params.bookingStatus];
      and.push({ booking: { status: { in: statuses } } });
    }

    if (and.length === 0) {
      throw new BadRequestException(
        'Prosledite bookingIds (ručni izbor) ili bar jedan filter (rezervacije/boravak/dolasci/odlasci od-do, status rezervacije) — prazan poziv bi zahvatio sve nenajavljene stavke ikad (M5 spec §8.4 dopuna v1.16).',
      );
    }

    return this.prepareGrouped({ AND: and }, generatedBy, language);
  }

  // Deljena logika za prepareForBooking/prepareBatch — pronađi nenajavljene CONTRACTED/CONFIRMED
  // stavke po datom filteru, grupiši ih po dobavljaču, napravi po jedan DRAFT nacrt za svakog.
  private async prepareGrouped(
    bookingFilter: Prisma.BookingItemWhereInput,
    generatedBy: string,
    language?: SupplierManifestLanguage,
  ) {
    const items = await this.prisma.bookingItem.findMany({
      where: {
        ...bookingFilter,
        sourceType: 'CONTRACTED',
        itemStatus: 'CONFIRMED',
        // "nisu najavljene" — nijedna aktivna (ne-SUPERSEDED, DRAFT ili SENT) lista je već ne sadrži.
        manifestEntries: { none: { supplierManifest: { status: { not: 'SUPERSEDED' } } } },
      },
      include: { product: { include: { sourceContract: true } }, rateLine: true },
    });

    const bySupplier = new Map<string, typeof items>();
    for (const item of items) {
      const supplierId = item.product.sourceContract?.supplierId;
      if (!supplierId) continue; // CONTRACTED stavka bez ugovora ne bi trebalo da postoji (M2 §2.1) — preskoči odbrambeno
      bySupplier.set(supplierId, [...(bySupplier.get(supplierId) ?? []), item]);
    }

    const manifests = [];
    for (const [supplierId, groupItems] of bySupplier) {
      const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
      const stayFroms = groupItems.map((i) => i.stayFrom.getTime());
      const stayTos = groupItems.map((i) => i.stayTo.getTime());
      const contractPeriodIds = new Set(groupItems.map((i) => i.rateLine?.contractPeriodId).filter(Boolean));

      manifests.push(
        await this.createManifest({
          supplierId,
          supplierType: supplier.type,
          // §8.1 — "nullable ako lista objedinjuje više perioda istog dobavljača" — ovde
          // moguće jer se grupiše po CELOJ rezervaciji/opsegu, ne po unapred poznatom periodu.
          contractPeriodId: contractPeriodIds.size === 1 ? [...contractPeriodIds][0]! : null,
          language: language ?? 'SR',
          periodFrom: new Date(Math.min(...stayFroms)),
          periodTo: new Date(Math.max(...stayTos)),
          itemIds: groupItems.map((i) => i.id),
          generatedBy,
        }),
      );
    }

    return manifests;
  }

  private async createManifest(params: {
    supplierId: string;
    supplierType: SupplierType;
    contractPeriodId: string | null;
    language: SupplierManifestLanguage;
    periodFrom: Date;
    periodTo: Date;
    itemIds: string[];
    generatedBy: string;
  }) {
    const referenceCode = await nextReferenceCode(this.prisma);
    const manifest = await this.prisma.supplierManifest.create({
      data: {
        supplierId: params.supplierId,
        contractPeriodId: params.contractPeriodId,
        supplierTypeSnapshot: params.supplierType,
        language: params.language,
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        status: 'DRAFT',
        generatedBy: params.generatedBy,
        referenceCode,
        items: { create: params.itemIds.map((bookingItemId) => ({ bookingItemId })) },
      },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: params.generatedBy === 'AI_AGENT_M5' ? 'AI_AGENT' : 'HUMAN',
      actorId: params.generatedBy === 'AI_AGENT_M5' ? null : params.generatedBy,
      module: 'M5',
      action: 'supplier_manifest.draft_generated',
      resourceType: 'SupplierManifest',
      resourceId: manifest.id,
      afterState: manifest,
      context: {},
    });

    return manifest;
  }

  // §8.4/§10 — slanje zahteva M5/supplier-manifest/SEND, NIKAD AI agent.
  async send(id: string, actorId: string) {
    const manifest = await this.findOne(id);
    // §8.4 (5.9.2026) — PENDING_SEND je takođe dozvoljen ulaz: to je lista koju smo pokušali da
    // pošaljemo a isporuke nije bilo. Kad provajder proradi, ista lista se šalje ponovo, bez
    // pravljenja nove. SENT i dalje odbija (ta lista je otišla; izmena ide preko SUPERSEDED, §8.5).
    if (manifest.status !== 'DRAFT' && manifest.status !== 'PENDING_SEND') {
      throw new BadRequestException(`SupplierManifest ${id} nije u statusu DRAFT ni PENDING_SEND.`);
    }
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: manifest.supplierId } });

    const result = await this.mailbox.sendViaSharedMailbox({
      toEmail: supplier.contactEmail,
      referenceCode: manifest.referenceCode ?? '',
      subject: `Operativna lista — ${supplier.name}`,
      documentUrl: manifest.documentUrl,
      supplierId: manifest.supplierId,
      supplierManifestId: manifest.id,
      actorUserId: actorId,
    });

    // §8.4 (5.9.2026, dok. 39 nalaz 1.2) — status prati STVARAN ishod isporuke. Kad poruka nije
    // otišla: `sent_at` ostaje prazan i `announced_at` se NE upisuje, pa stavke ostaju
    // nenajavljene u svakoj postojećoj proveri, bez ijedne dodatne logike. Ranije je ovde
    // bezuslovno pisalo SENT, pa se pripremljeno nije razlikovalo od poslatog.
    const now = new Date();
    const updated = result.delivered
      ? (
          await this.prisma.$transaction([
            this.prisma.supplierManifest.update({
              where: { id },
              data: { status: 'SENT', sentAt: now, sentBy: actorId, sentToEmail: supplier.contactEmail },
            }),
            // §8.6 — announced_at se popunjava na svakoj obuhvaćenoj BookingItem.
            this.prisma.bookingItem.updateMany({
              where: { id: { in: manifest.items.map((i) => i.bookingItemId) } },
              data: { announcedAt: now },
            }),
          ])
        )[0]
      : await this.prisma.supplierManifest.update({
          where: { id },
          data: { status: 'PENDING_SEND', sentBy: actorId, sentToEmail: supplier.contactEmail },
        });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      // Odvojena akcija za neisporučeno — u revizijskom tragu se posle mora videti razlika
      // između „otišlo hotelu" i „pokušano, nije otišlo".
      action: result.delivered ? 'supplier_manifest.sent' : 'supplier_manifest.send_pending',
      resourceType: 'SupplierManifest',
      resourceId: id,
      afterState: updated,
      context: result.delivered ? {} : { reason: result.reason ?? null },
    });
    return updated;
  }

  // §8.6 — ručni unos potvrde dobavljača, popunjava sve stavke te liste.
  async confirmSupplier(id: string, actorId: string) {
    const manifest = await this.findOne(id);
    if (manifest.status !== 'SENT') throw new BadRequestException(`SupplierManifest ${id} nije poslat.`);
    const now = new Date();

    await this.prisma.bookingItem.updateMany({
      where: { id: { in: manifest.items.map((i) => i.bookingItemId) } },
      data: { supplierConfirmedAt: now, supplierConfirmedBy: actorId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_manifest.supplier_confirmed',
      resourceType: 'SupplierManifest',
      resourceId: id,
      context: {},
    });
    return this.findOne(id);
  }

  /**
   * M5 spec §8.5 — "izmene posle slanja": ako stavka na već poslatoj (SENT) listi bude
   * izmenjena/otkazana (poglavlje 6), postojeća lista se SUPERSEDED, priprema se nova
   * DRAFT sa preostalim (i dalje aktivnim) stavkama, supersedes_manifest_id ka prethodnoj.
   * Poziva se iz BookingsService.cancel()/modify() posle promene item_status.
   */
  async supersedeIfOnSentManifest(bookingItemId: string, generatedBy: string) {
    const entry = await this.prisma.supplierManifestItem.findFirst({
      where: { bookingItemId, supplierManifest: { status: 'SENT' } },
      include: { supplierManifest: { include: { items: true } } },
    });
    if (!entry) return null;

    const oldManifest = entry.supplierManifest;
    const remainingItemIds = (
      await this.prisma.bookingItem.findMany({
        where: { id: { in: oldManifest.items.map((i) => i.bookingItemId) }, itemStatus: { not: 'CANCELLED' } },
        select: { id: true },
      })
    ).map((i) => i.id);

    const referenceCode = await nextReferenceCode(this.prisma);
    const [, newManifest] = await this.prisma.$transaction([
      this.prisma.supplierManifest.update({ where: { id: oldManifest.id }, data: { status: 'SUPERSEDED' } }),
      this.prisma.supplierManifest.create({
        data: {
          supplierId: oldManifest.supplierId,
          contractPeriodId: oldManifest.contractPeriodId,
          supplierTypeSnapshot: oldManifest.supplierTypeSnapshot,
          language: oldManifest.language, // §8.3 — jezik se NE menja na revizijama
          periodFrom: oldManifest.periodFrom,
          periodTo: oldManifest.periodTo,
          status: 'DRAFT',
          generatedBy,
          referenceCode,
          supersedesManifestId: oldManifest.id,
          items: { create: remainingItemIds.map((bookingItemId) => ({ bookingItemId })) },
        },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M5',
      action: 'supplier_manifest.superseded',
      resourceType: 'SupplierManifest',
      resourceId: oldManifest.id,
      afterState: { supersededBy: newManifest.id },
      context: { bookingItemId },
    });

    return newManifest;
  }
}
