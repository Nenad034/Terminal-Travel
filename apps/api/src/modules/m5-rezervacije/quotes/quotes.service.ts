import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuoteItemBuilderService } from './quote-item-builder.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { LoyaltyStubService } from '../common/loyalty-stub.service';
import { SubagentStubService } from '../common/subagent-stub.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { resolveApiContext, type M5CallerContext } from '../common/resolve-api-context';
import { serializeQuote, type RawQuote } from './quote-visibility';
import { findDateMismatches } from '../common/date-mismatch';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

// M5 spec §3.1 — "expires_at = najkraći quote_expires_at među stavkama (M4) ili
// podrazumevanih 30 min za čisto ugovorene stavke."
const DEFAULT_QUOTE_EXPIRY_MINUTES = 30;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: QuoteItemBuilderService,
    private readonly loyalty: LoyaltyStubService,
    private readonly subagentStub: SubagentStubService,
    private readonly auditLog: AuditLogService,
  ) {}

  // M5 spec §3.1/§3.2/§3.0b.3 — POST /quotes: konstruiše sve stavke po ISTIM pravilima
  // cene/marže kao POST /itineraries/:id/to-quote (deljeno preko QuoteItemBuilderService).
  async create(dto: CreateQuoteDto, actor: { userId?: string } | null) {
    // §6.2 obrazac dopune (avgust 2026, priprema za M8) — client_account_id se NIKAD ne
    // uzima direktno iz tela zahteva za GUEST pozivaoca; bez ovoga bi gost mogao da
    // pripiše Quote/Booking tuđem nalogu (i tuđ popust lojalnosti) prostim slanjem tuđeg
    // clientAccountId parametra. Interno osoblje zadržava puno poverenje u parametar
    // (kreira ponudu u ime bilo kog klijenta).
    // M7 spec §6.2 dopuna — SUBAGENT_CONTACT pozivalac takođe dobija clientAccountId primoran
    // na sopstveni nalog, isti razlog kao GUEST iznad. identity.ownProfileId je za
    // SUBAGENT_CONTACT Subagent.id (resolve-caller-identity.ts), mora se mapirati na pravi
    // ClientAccount.id preko SubagentStubService pre nego što uđe u Quote.client_account_id.
    let clientAccountId = dto.clientAccountId;
    let callerAccountType: string | null = null;
    if (actor?.userId) {
      const identity = await resolveCallerIdentity(this.prisma, actor.userId);
      callerAccountType = identity.accountType;
      if (identity.accountType === 'GUEST') {
        clientAccountId = identity.ownProfileId ?? undefined;
      } else if (identity.accountType === 'SUBAGENT_CONTACT' && identity.ownProfileId) {
        clientAccountId = (await this.subagentStub.resolveClientAccountIdForSubagentContact(identity.ownProfileId)) ?? undefined;
      } else if (identity.accountType === 'AI_AGENT') {
        // M16 spec §2 dopuna — MCP klijent, isti razlog kao GUEST iznad ali bez stub
        // posredovanja: User.linked_profile_id je već direktno ClientAccount.id (bookings.service.ts).
        clientAccountId = identity.ownProfileId ?? undefined;
      }
    }

    // M5 spec §3.0d.6a — build() vraća niz po stavci zahteva (PACKAGE gradi više QuoteItem-a
    // odjednom iz included_products[]); .flat() spaja sve u jedan ravan niz stavki Ponude.
    const built = (
      await Promise.all(
        dto.items.map((item) =>
          this.builder.build({
            productId: item.productId,
            stayFrom: item.stayFrom,
            stayTo: item.stayTo,
            occupancy: item.occupancy,
            rateLineId: item.rateLineId ?? null,
            providerQuoteReference: item.providerQuoteReference ?? null,
            selectedOfferQuoteExpiresAt: item.selectedOfferQuoteExpiresAt ?? null,
          }),
        ),
      )
    ).flat();

    // M5 spec §3.0e.3a (dopuna 29.8.2026) — server je jedini pravi oslonac (klijentska provera
    // u RightPanel.tsx je samo brža povratna informacija). Bez `date_mismatch_acknowledged`,
    // PREVOZ (let/transfer) stavka čiji se datum uopšte ne preklapa sa opsegom BORAVAK stavki
    // (uz toleranciju 1 dan) blokira kreiranje Ponude umesto da tiho prođe.
    const dateMismatch = findDateMismatches(built.map((b) => ({ productId: b.productId, type: b.type, stayFrom: b.stayFrom, stayTo: b.stayTo })));
    if (dateMismatch.mismatched.length > 0 && !dto.dateMismatchAcknowledged) {
      throw new BadRequestException({
        message: 'Datumi stavki se ne poklapaju — termin prevoza je van perioda boravka. Potvrdite da je ovo namerno (M5 spec §3.0e.3a).',
        code: 'DATE_MISMATCH',
        mismatchedProductIds: dateMismatch.mismatched.map((m) => m.productId),
      });
    }

    const apiExpiries = built.map((b) => b.quoteExpiresAt).filter((v): v is string => v != null);
    const expiresAt =
      apiExpiries.length > 0
        ? new Date(Math.min(...apiExpiries.map((v) => new Date(v).getTime())))
        : new Date(Date.now() + DEFAULT_QUOTE_EXPIRY_MINUTES * 60_000);

    // M7 spec §5 — B2B subagenti NE učestvuju u M6 loyalty programu; ako Quote.client_account_id
    // ima Subagent zapis (proverava se POSTOJANJE zapisa, ne ClientAccount.account_type — jedan
    // LEGAL_ENTITY nalog bez Subagent zapisa je i dalje običan M6/M5 kupac), primenjuje se
    // effective_commission_percentage UMESTO M6 loyalty-status, kao poslednji korak posle marže
    // (isti obrazac/mesto u toku cene kao M6 spec §3.3).
    let discountPercentage = 0;
    if (clientAccountId) {
      const commissionPercentage = await this.subagentStub.getEffectiveCommissionPercentageForClientAccount(clientAccountId);
      discountPercentage = commissionPercentage != null ? commissionPercentage : await this.loyalty.getDiscountPercentage(clientAccountId);
    }
    const applyDiscount = (price: number) => (discountPercentage > 0 ? Math.round(price * (1 - discountPercentage / 100)) : price);

    const quote = await this.prisma.quote.create({
      data: {
        clientAccountId,
        channel: dto.channel,
        status: 'DRAFT',
        expiresAt,
        contractTermsAccepted: dto.contractTermsAccepted ?? false,
        contractTermsAcceptedAt: dto.contractTermsAccepted ? new Date() : null,
        createdBy: actor?.userId ?? null,
        referralTrackingCode: dto.referralTrackingCode,
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
            finalPrice: applyDiscount(b.finalPrice),
            finalPriceCurrency: b.finalPriceCurrency,
            providerQuoteReference: b.providerQuoteReference,
            unitCount: b.unitCount,
            cancellationPolicySnapshot: b.cancellationPolicySnapshot as any,
          })),
        },
      },
      include: { items: true },
    });

    // M5 spec §3.0e.3a — upisuje se TEK sad da `resourceId` bude prava Ponuda, ne pre kreiranja.
    if (dateMismatch.mismatched.length > 0 && dto.dateMismatchAcknowledged) {
      await this.auditLog.write({
        actorType: callerAccountType === 'AI_AGENT' ? 'AI_AGENT' : 'HUMAN',
        actorId: actor?.userId ?? null,
        module: 'M5',
        action: 'quote.date_mismatch_override',
        resourceType: 'Quote',
        resourceId: quote.id,
        context: {
          mismatchedItems: dateMismatch.mismatched.map((m) => ({ productId: m.productId, type: m.type, stayFrom: m.stayFrom, stayTo: m.stayTo })),
        },
      });
    }

    return quote;
  }

  // M5 spec §11 — GET /quotes/:id: "pregled ponude, uključujući da li je istekla."
  // Ispravka 28.8.2026 (bezbednosni nalaz, pre lansiranja pregled) — ranije je proveravala
  // ownership SAMO za GUEST (SUBAGENT_CONTACT/AI_AGENT su prolazili bez ikakve provere, IDOR:
  // bilo koji subagent ili MCP klijent mogao je da učita TUĐU ponudu po ID-ju), i NIKAD nije
  // maskirala odgovor (§6.2/M2 §5.1 — baseCost/markupRuleId/providerQuoteReference su curili
  // ka B2C/B2B/MCP kanalima). Sad deli isti `resolveApiContext`/whitelist obrazac kao
  // `BookingsService` — isti bag klase koju je deljena funkcija upravo trebalo da spreči.
  async findOne(id: string, actorUserId?: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { items: true } });
    if (!quote) throw new NotFoundException(`Ponuda ${id} nije pronađena.`);

    let context: M5CallerContext = 'INTERNAL_PANEL';
    if (actorUserId) {
      const resolved = await resolveApiContext(this.prisma, this.subagentStub, actorUserId);
      context = resolved.context;
      if (context !== 'INTERNAL_PANEL' && quote.clientAccountId !== resolved.ownClientAccountId) {
        throw new NotFoundException(`Ponuda ${id} nije pronađena.`);
      }
    }

    const serialized = serializeQuote(quote as unknown as RawQuote, context);
    return { ...serialized, isExpired: quote.status === 'DRAFT' && quote.expiresAt.getTime() < Date.now() };
  }
}
