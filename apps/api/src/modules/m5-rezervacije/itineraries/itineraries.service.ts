import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuoteItemBuilderService } from '../quotes/quote-item-builder.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { resolveApiContext } from '../common/resolve-api-context';
import { SubagentStubService } from '../common/subagent-stub.service';

const DEFAULT_QUOTE_EXPIRY_MINUTES = 30;

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: QuoteItemBuilderService,
    private readonly subagentStub: SubagentStubService,
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
        clientAccountId = (await this.subagentStub.resolveClientAccountIdForSubagentContact(identity.ownProfileId)) ?? undefined;
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
      const { context, ownClientAccountId } = await resolveApiContext(this.prisma, this.subagentStub, actorUserId);
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
      const { context, ownClientAccountId } = await resolveApiContext(this.prisma, this.subagentStub, actorUserId);
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
   * M5 spec §3.0.3 — POST /itineraries/:id/to-quote: svaki segment sa product_id postaje
   * QuoteItem po ISTIM pravilima cene/marže kao POST /quotes (QuoteItemBuilderService).
   * Segmenti bez product_id se PRESKAČU uz eksplicitno upozorenje, ne tiho.
   */
  async convertToQuote(id: string, actor: { userId?: string } | null) {
    const itinerary = await this.findOne(id, actor?.userId);
    if (itinerary.status !== 'DRAFT') {
      throw new BadRequestException(`Itinerary ${id} nije u statusu DRAFT (već konvertovan ili napušten).`);
    }

    const withProduct = itinerary.segments.filter((s) => s.productId);
    const skipped = itinerary.segments.filter((s) => !s.productId).map((s) => s.id);

    if (withProduct.length === 0) {
      throw new BadRequestException(
        'Nijedan segment nema popunjen product_id — nema šta da se konvertuje u Ponudu (M5 spec §3.0.3).',
      );
    }

    // §3.0.3 — occupancy nije deo Itinerary/ItinerarySegment modela (§3.0.2); segmenti nose
    // samo product/datume. Konverzija zato pretpostavlja jednu odraslu osobu po sobi dok
    // korisnik ne dopuni tačan sastav gostiju kroz izmenu nastale Quote/QuoteItem — Itinerary
    // sam ne drži broj gostiju (van obima §3.0.2 tabele polja).
    const built = await Promise.all(
      withProduct.map((segment) =>
        this.builder.build({
          productId: segment.productId!,
          stayFrom: (segment.stayFrom ?? new Date()).toISOString(),
          stayTo: (segment.stayTo ?? new Date()).toISOString(),
          occupancy: { adults: 1, children: 0 },
        }),
      ),
    );

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
}
