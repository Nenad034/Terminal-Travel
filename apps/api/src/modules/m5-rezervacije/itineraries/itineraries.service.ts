import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuoteItemBuilderService } from '../quotes/quote-item-builder.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { resolveApiContext } from '../common/resolve-api-context';
import { SubagentBridgeService } from '../common/subagent-bridge.service';

const DEFAULT_QUOTE_EXPIRY_MINUTES = 30;

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: QuoteItemBuilderService,
    private readonly subagentBridge: SubagentBridgeService,
  ) {}

  // M5 spec §3.0.1 dopuna (31.8.2026, IDOR pregled — Itinerary nije bio obuhvaćen ranijim
  // Faza 8 prolazom jer tad još nije bio na dnevnom redu). GUEST/SUBAGENT_CONTACT/AI_AGENT
  // pozivalac dobija client_account_id PRIMORAN na sopstveni nalog, isti razlog i isti obrazac
  // kao QuotesService.create — bez ovoga bi gost mogao da pripiše Itinerary tuđem nalogu prostim
  // slanjem tuđeg clientAccountId parametra.
  async create(dto: CreateItineraryDto, actor: { userId?: string } | null) {
    let clientAccountId = dto.clientAccountId;
    if (actor?.userId) {
      const identity = await resolveCallerIdentity(this.prisma, actor.userId);
      if (identity.accountType === 'GUEST' || identity.accountType === 'AI_AGENT') {
        clientAccountId = identity.ownProfileId ?? undefined;
      } else if (identity.accountType === 'SUBAGENT_CONTACT' && identity.ownProfileId) {
        clientAccountId = (await this.subagentBridge.resolveClientAccountIdForSubagentContact(identity.ownProfileId)) ?? undefined;
      }
    }
    return this.prisma.itinerary.create({
      data: {
        channel: dto.channel,
        title: dto.title,
        clientAccountId,
        createdBy: actor?.userId ?? null,
        status: 'DRAFT',
      },
    });
  }

  // M5 spec §3.0.1 dopuna (31.8.2026, IDOR pregled) — isti obrazac kao BookingsService.findAll:
  // van INTERNAL_PANEL, klijentski `clientAccountId` parametar se IGNORIŠE i zamenjuje
  // pozivaočevim sopstvenim nalogom — bez ovoga bi gost mogao da vidi tuđe itinerare menjajući
  // query parametar.
  async findAll(clientAccountId: string | undefined, actorUserId?: string) {
    let effectiveClientAccountId = clientAccountId;
    if (actorUserId) {
      const { context, ownClientAccountId } = await resolveApiContext(this.prisma, this.subagentBridge, actorUserId);
      if (context !== 'INTERNAL_PANEL') effectiveClientAccountId = ownClientAccountId ?? undefined;
    }
    return this.prisma.itinerary.findMany({
      where: effectiveClientAccountId ? { clientAccountId: effectiveClientAccountId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { segments: { orderBy: { sequenceOrder: 'asc' } } },
    });
  }

  // M5 spec §3.0.1 dopuna (31.8.2026, IDOR pregled) — isti obrazac kao QuotesService.findOne:
  // van INTERNAL_PANEL, itinerar koji ne pripada pozivaocu vraća 404 (ne otkriva postojanje).
  async findOne(id: string, actorUserId?: string) {
    const itinerary = await this.prisma.itinerary.findUnique({
      where: { id },
      include: { segments: { orderBy: { sequenceOrder: 'asc' } } },
    });
    if (!itinerary) throw new NotFoundException(`Itinerary ${id} nije pronađen.`);
    if (actorUserId) {
      const { context, ownClientAccountId } = await resolveApiContext(this.prisma, this.subagentBridge, actorUserId);
      if (context !== 'INTERNAL_PANEL' && itinerary.clientAccountId !== ownClientAccountId) {
        throw new NotFoundException(`Itinerary ${id} nije pronađen.`);
      }
    }
    return itinerary;
  }

  // M5 spec §3.0.2 — "dodavanje/brisanje/preslagivanje segmenata" kroz PATCH; kad su
  // segments poslati, ZAMENJUJU ceo postojeći skup (isti obrazac dokumentovan u DTO).
  // IDOR pregled (31.8.2026) — findOne sad nosi proveru vlasništva, `update` je nasleđuje
  // pozivom findOne(id, actorUserId) umesto golog findOne(id).
  async update(id: string, dto: UpdateItineraryDto, actorUserId?: string) {
    await this.findOne(id, actorUserId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.segments) {
        await tx.itinerarySegment.deleteMany({ where: { itineraryId: id } });
        if (dto.segments.length > 0) {
          await tx.itinerarySegment.createMany({
            data: dto.segments.map((s) => ({
              itineraryId: id,
              sequenceOrder: s.sequenceOrder,
              productId: s.productId,
              destinationCountry: s.destinationCountry,
              destinationCity: s.destinationCity,
              stayFrom: s.stayFrom ? new Date(s.stayFrom) : null,
              stayTo: s.stayTo ? new Date(s.stayTo) : null,
              notes: s.notes,
              isIncluded: s.isIncluded ?? true,
              occupancy: s.occupancy as any,
              previewBaseCost: s.previewBaseCost,
              previewFinalPrice: s.previewFinalPrice,
              previewFinalPriceCurrency: s.previewFinalPriceCurrency,
              previewSourceType: s.previewSourceType,
            })),
          });
        }
      }
      return tx.itinerary.update({
        where: { id },
        data: { title: dto.title },
        include: { segments: { orderBy: { sequenceOrder: 'asc' } } },
      });
    });
  }

  /**
   * M5 spec §3.0.3 — POST /itineraries/:id/to-quote: svaki segment sa `is_included = true` i
   * popunjenim product_id postaje QuoteItem po ISTIM pravilima cene/marže kao POST /quotes
   * (QuoteItemBuilderService). Segmenti sa `is_included = false` se TIHO preskaču (namerno
   * isključeni); segmenti `is_included = true` bez product_id se preskaču uz upozorenje.
   */
  async convertToQuote(id: string, actor: { userId?: string } | null) {
    const itinerary = await this.findOne(id, actor?.userId);
    if (itinerary.status !== 'DRAFT') {
      throw new BadRequestException(`Itinerary ${id} nije u statusu DRAFT (već konvertovan ili napušten).`);
    }

    const included = itinerary.segments.filter((s) => s.isIncluded);
    const withProduct = included.filter((s) => s.productId);
    const skipped = included.filter((s) => !s.productId).map((s) => s.id);

    if (withProduct.length === 0) {
      throw new BadRequestException(
        'Nijedan uključen segment nema popunjen product_id — nema šta da se konvertuje u Ponudu (M5 spec §3.0.3).',
      );
    }

    // §3.0.2/§3.0.3 dopuna (31.8.2026) — kad segment nosi sopstveni occupancy (npr. porodica
    // koja u jednom gradu putuje sa 4 osobe, a u drugom sa 2), koristi se on; bez toga (`null`,
    // stariji nacrti pre ove dopune) zadržava se dosadašnje podrazumevano ponašanje — jedna
    // odrasla osoba, korisnik dopunjava tačan sastav kroz izmenu nastale QuoteItem.
    // §3.0d.6a — build() vraća niz po segmentu (PACKAGE segment gradi više QuoteItem-a
    // odjednom); .flat() spaja sve u jedan ravan niz stavki Ponude.
    const built = (
      await Promise.all(
        withProduct.map((segment) =>
          this.builder.build({
            productId: segment.productId!,
            stayFrom: (segment.stayFrom ?? new Date()).toISOString(),
            stayTo: (segment.stayTo ?? new Date()).toISOString(),
            occupancy: (segment.occupancy as any) ?? { adults: 1, children: 0 },
          }),
        ),
      )
    ).flat();

    const apiExpiries = built.map((b) => b.quoteExpiresAt).filter((v): v is string => v != null);
    const expiresAt =
      apiExpiries.length > 0
        ? new Date(Math.min(...apiExpiries.map((v) => new Date(v).getTime())))
        : new Date(Date.now() + DEFAULT_QUOTE_EXPIRY_MINUTES * 60_000);

    const [quote] = await this.prisma.$transaction([
      this.prisma.quote.create({
        data: {
          clientAccountId: itinerary.clientAccountId,
          channel: itinerary.channel,
          status: 'DRAFT',
          expiresAt,
          itineraryId: itinerary.id,
          createdBy: actor?.userId ?? null,
          items: {
            create: built.map((b) => ({
              productId: b.productId,
              sourceType: b.sourceType,
              stayFrom: b.stayFrom,
              stayTo: b.stayTo,
              occupancy: b.occupancy as any,
              baseCost: b.baseCost,
              baseCostCurrency: b.baseCostCurrency,
              rateLineId: b.rateLineId,
              markupRuleId: b.markupRuleId,
              finalPrice: b.finalPrice,
              finalPriceCurrency: b.finalPriceCurrency,
              providerQuoteReference: b.providerQuoteReference,
              unitCount: b.unitCount,
              cancellationPolicySnapshot: b.cancellationPolicySnapshot as any,
            })),
          },
        },
        include: { items: true },
      }),
      this.prisma.itinerary.update({ where: { id }, data: { status: 'CONVERTED' } }),
    ]);

    return {
      quote,
      skippedSegmentIds: skipped,
      warning:
        skipped.length > 0
          ? `${skipped.length} segment(a) preskočeno jer nema popunjen product_id (M5 spec §3.0.3).`
          : null,
    };
  }

  /**
   * M5 spec §3.0.3a — POST /itineraries/:id/abandon. Vlasnikova odluka (1.9.2026): samo ručna
   * akcija, bez automatskog isteka po neaktivnosti (Itinerary ne drži kapacitet niti cenu).
   * Napušten nacrt ostaje u bazi kao istorijski zapis — ova akcija ne briše ništa.
   */
  async abandon(id: string, actorUserId?: string) {
    const itinerary = await this.findOne(id, actorUserId);
    if (itinerary.status !== 'DRAFT') {
      throw new BadRequestException(`Itinerary ${id} nije u statusu DRAFT (već konvertovan ili napušten).`);
    }
    return this.prisma.itinerary.update({ where: { id }, data: { status: 'ABANDONED' } });
  }
}
