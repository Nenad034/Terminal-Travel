import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AgeCategory, AgePricingMode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { PRAG_AUTOMATSKOG_POKLAPANJA, nadjiNajbolji } from './hotel-matching';

/**
 * M3 spec §4.2 / §4.2.6 — AI uvoz cenovnika.
 *
 * PODELA POSLA (§4.2.6, M15 princip „kod radi najviše posla"):
 *  - model čita tabelu iz slobodnog teksta — jedini korak koji kod ne može;
 *  - poklapanje hotela sa katalogom, upis u bazu i profil dobavljača rade determinističke
 *    funkcije, jer se od njih traži da isti unos uvek daju isto.
 *
 * NIVO AUTONOMIJE (§4.2.4): ovaj servis piše ISKLJUČIVO u `PricelistImportRow` — pripremu koju
 * čovek pregleda. Nijedan `ContractPeriod` ni `RateLine` ne nastaje ovde; to radi
 * `PricelistImportsService.reviewRow` tek posle ljudske potvrde.
 */

interface IzvuceniRed {
  hotel: string;
  room_type: string;
  board_type: string;
  occupancy: string;
  stay_from: string;
  stay_to: string;
  price_minor_units: number;
  currency: string;
  price_basis?: 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | null;
  crib_fee_per_night?: number | null;
  age_pricing?: {
    age_category: string;
    min_adults_present?: number | null;
    pricing_mode: 'PERCENTAGE_OF_BASE_PRICE' | 'FLAT_PRICE_PER_NIGHT';
    percentage?: number | null;
    flat_price?: number | null;
  }[];
}

/**
 * Model odgovara ISKLJUČIVO kroz ovaj alat, ne slobodnim tekstom (§4.2.6). Slobodan tekst koji
 * treba pretvoriti u cenu je mesto gde greška ulazi tiho — šema odbija sve što nije broj tamo
 * gde broj mora biti.
 */
const ALAT = {
  name: 'upisi_redove_cenovnika',
  description:
    'Vraća redove cenovnika izvučene iz teksta. Jedan red = jedna kombinacija hotel/soba/usluga/period/cena.',
  input_schema: {
    type: 'object' as const,
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hotel: { type: 'string', description: 'Naziv objekta tačno kako piše u dokumentu' },
            room_type: { type: 'string', description: 'Tip sobe, npr. DBL, standard, apartman' },
            board_type: {
              type: 'string',
              description: 'Usluga, npr. BB, polupansion, all inclusive',
            },
            occupancy: {
              type: 'string',
              description: 'Na koga se cena odnosi, npr. "odrasla osoba u dvokrevetnoj"',
            },
            stay_from: { type: 'string', description: 'Početak perioda, oblik YYYY-MM-DD' },
            stay_to: { type: 'string', description: 'Kraj perioda, oblik YYYY-MM-DD' },
            price_minor_units: {
              type: 'integer',
              description:
                'Cena u NAJMANJOJ jedinici valute: 89,50 EUR = 8950. Nikad decimalan broj.',
            },
            currency: { type: 'string', description: 'Troslovna oznaka, npr. EUR' },
            price_basis: {
              type: ['string', 'null'],
              enum: ['PER_ROOM_PER_NIGHT', 'PER_PERSON_PER_NIGHT', null],
              description: 'null ako iz dokumenta nije pouzdano jasno — ne pogađaj',
            },
            crib_fee_per_night: { type: ['integer', 'null'] },
            age_pricing: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  // IZVEDENO iz Prisma enuma, ne prepisano (9.9.2026): prva verzija je ovde
                  // ukucala 'BABY', a enum ima 'INFANT' — poziv je prolazio kroz šemu alata i
                  // padao tek pri upisu, sa porukom koju korisnik ne može da razume.
                  age_category: { type: 'string', enum: Object.values(AgeCategory) },
                  min_adults_present: { type: ['integer', 'null'] },
                  pricing_mode: { type: 'string', enum: Object.values(AgePricingMode) },
                  percentage: { type: ['number', 'null'] },
                  flat_price: { type: ['integer', 'null'] },
                },
                required: ['age_category', 'pricing_mode'],
              },
            },
          },
          required: [
            'hotel',
            'room_type',
            'board_type',
            'occupancy',
            'stay_from',
            'stay_to',
            'price_minor_units',
            'currency',
          ],
        },
      },
    },
    required: ['rows'],
  },
};

@Injectable()
export class PricelistExtractionService {
  private readonly logger = new Logger(PricelistExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  /**
   * §4.2.6 — `PROCESSING → READY_FOR_REVIEW` ili `FAILED` sa razlogom.
   *
   * Uvoz koji ne uspe NIKAD ne ostaje u `PROCESSING`: to je stanje u kom ekran čeka nešto što
   * se nikad neće desiti, i tačno tako je izgledalo pre 9.9.2026 (uvoz je nastajao i tu stajao).
   */
  async extract(importId: string, actorId: string) {
    const uvoz = await this.prisma.pricelistImport.findUniqueOrThrow({ where: { id: importId } });
    if (uvoz.status !== 'PROCESSING') {
      throw new BadRequestException(
        `Ekstrakcija se pokreće samo nad uvozom u statusu PROCESSING (trenutno: ${uvoz.status})`,
      );
    }
    if (!uvoz.sourceText) {
      return this.oznaciNeuspeh(
        importId,
        'Ovaj uvoz nema nalepljen tekst. Učitavanje PDF/Excel fajla još nije podržano (M3 §4.2.6).',
      );
    }
    if (!this.anthropic.isConfigured()) {
      return this.oznaciNeuspeh(
        importId,
        'AI ekstrakcija trenutno nije dostupna (ANTHROPIC_API_KEY nije podešen na serveru).',
      );
    }

    try {
      const redovi = await this.pozoviModel(uvoz.sourceText, uvoz.supplierId);
      const ispravni = redovi.filter((r) => this.jeIspravan(r));
      if (ispravni.length === 0) {
        return this.oznaciNeuspeh(
          importId,
          redovi.length === 0
            ? 'AI nije prepoznao nijedan red cenovnika u ovom tekstu.'
            : `AI je vratio ${redovi.length} redova, ali nijedan nije prošao proveru (cena mora biti ceo pozitivan broj u najmanjoj jedinici valute, datumi u obliku GGGG-MM-DD).`,
        );
      }

      await this.upisiRedove(importId, uvoz.supplierId, ispravni);

      const azuriran = await this.prisma.pricelistImport.update({
        where: { id: importId },
        data: { status: 'READY_FOR_REVIEW', failureReason: null },
      });

      await this.auditLog.write({
        actorType: 'AI_AGENT',
        actorId,
        module: 'M3',
        action: 'pricelist_import.extracted',
        resourceType: 'PricelistImport',
        resourceId: importId,
        afterState: { status: azuriran.status, rows: ispravni.length },
        context: { vraceno: redovi.length, odbaceno: redovi.length - ispravni.length },
      });

      return { ...azuriran, rows: ispravni.length, odbaceno: redovi.length - ispravni.length };
    } catch (err) {
      this.logger.warn(`Ekstrakcija cenovnika nije uspela: ${(err as Error).message}`);
      return this.oznaciNeuspeh(
        importId,
        `AI ekstrakcija nije uspela: ${(err as Error).message}. Pokušaj ponovo ili unesi cene ručno.`,
      );
    }
  }

  /**
   * §4.2.6 — ponovni pokušaj nad uvozom koji je pao. Vraća ga u `PROCESSING` i poziva model
   * ponovo nad ISTIM tekstom.
   *
   * Postoji zato što je najčešći uzrok neuspeha prolazan (prekid ka provajderu, ograničenje
   * potrošnje), a bez ovoga bi čovek morao ponovo da nalepi ceo cenovnik i napravi drugi zapis —
   * pa bi se u spisku videla dva uvoza za jedan posao.
   */
  async retry(importId: string, actorId: string) {
    const uvoz = await this.prisma.pricelistImport.findUniqueOrThrow({ where: { id: importId } });
    if (uvoz.status !== 'FAILED') {
      throw new BadRequestException(
        `Ponovni pokušaj ima smisla samo nad uvozom u statusu FAILED (trenutno: ${uvoz.status})`,
      );
    }
    await this.prisma.pricelistImport.update({
      where: { id: importId },
      data: { status: 'PROCESSING', failureReason: null },
    });
    return this.extract(importId, actorId);
  }

  private async oznaciNeuspeh(importId: string, razlog: string) {
    return this.prisma.pricelistImport.update({
      where: { id: importId },
      data: { status: 'FAILED', failureReason: razlog },
    });
  }

  /**
   * §4.2.5 — profil dobavljača se čita iz baze i daje modelu kao NAGOVEŠTAJ. Ne traži se od
   * modela da išta pamti između poziva; pamćenje je red u bazi, model je samo čitač.
   */
  private async pozoviModel(tekst: string, supplierId: string): Promise<IzvuceniRed[]> {
    const profil = await this.prisma.supplierExtractionProfile.findUnique({
      where: { supplierId },
    });

    const nagovestaj = profil?.typicalPriceBasis
      ? `\n\nNAGOVEŠTAJ iz ranijih cenovnika ovog dobavljača: osnova cene je obično ${profil.typicalPriceBasis}. Koristi to SAMO ako dokument ne kaže drugačije.`
      : '';

    // Pravila 6–8 dodata 9.9.2026, posle PRVOG stvarnog poziva nad pravim cenovnikom: model je
    // vratio 10 redova gde su 4 tačna — isti period/soba/usluga se ponavljao jednom bez dečje
    // cene i jednom sa njom, a doplata za krevetac (5,00 EUR) je postala zaseban red sa cenom
    // 500. To nije greška modela nego nedorečeno uputstvo: nigde nije pisalo šta je JEDAN red.
    const system =
      'Ti si PricelistImportAgent agencije Terminal Travel. Iz teksta cenovnika dobavljača izvlačiš ' +
      'redove u zadatu strukturu i ništa više. Pravila: (1) prepisuješ ono što u dokumentu piše — ' +
      'ne popunjavaš praznine pretpostavkom; (2) cena ide u NAJMANJOJ jedinici valute, dakle ' +
      '89,50 EUR postaje 8950; (3) ako osnova cene (po sobi ili po osobi) nije jasna, vrati null — ' +
      'čovek će je potvrditi, tvoja pogrešna pretpostavka bi postala pogrešna prodajna cena; ' +
      '(4) datume vrati u obliku GGGG-MM-DD; (5) ti ništa ne upisuješ u sistem — svaki red ide ' +
      'čoveku na potvrdu; ' +
      '(6) JEDAN RED = jedna kombinacija period + tip sobe + usluga. Nikad dva reda za istu ' +
      'kombinaciju: ako za nju postoji i dečja cena, ona ide u age_pricing TOG reda, ne u nov red; ' +
      '(7) doplate (krevetac, dodatni ležaj) NISU red cenovnika — krevetac ide isključivo u polje ' +
      'crib_fee_per_night reda na koji se odnosi; ' +
      '(8) u polje hotel upiši SAMO naziv objekta, bez mesta i bez države — „Hotel Splendid, Bečići" ' +
      'je „Hotel Splendid".';

    const client = this.anthropic.getClient();
    const odgovor = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 4096,
      system,
      tools: [ALAT],
      tool_choice: { type: 'tool', name: ALAT.name },
      messages: [{ role: 'user', content: `Tekst cenovnika:\n\n${tekst}${nagovestaj}` }],
    });

    await this.zabeleziPoziv(odgovor);

    const alat = odgovor.content.find((b: { type: string }) => b.type === 'tool_use') as
      { input?: { rows?: IzvuceniRed[] } } | undefined;
    return alat?.input?.rows ?? [];
  }

  private async zabeleziPoziv(odgovor: { usage: { input_tokens: number; output_tokens: number } }) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { agentRole: 'PRICELIST_IMPORT_AGENT' },
    });
    if (!agent) return;
    await this.invocationLog.record({
      agentId: agent.id,
      actionCode: 'pricelist_import.extract',
      requestedTier: agent.modelTier ?? 'LIGHT',
      securityCritical: false,
      modelIdentifier: AnthropicClientService.MODEL,
      inputTokens: odgovor.usage.input_tokens,
      outputTokens: odgovor.usage.output_tokens,
      latencyMs: 0,
    });
  }

  /**
   * Provera POSLE modela, ne umesto njega. Šema alata traži tip, ali ne i da je cena pozitivna
   * ni da je datum stvaran — a red sa cenom `0` ili datumom „31.02." ne sme ni da stigne do
   * čoveka, jer izgleda kao podatak.
   */
  private jeIspravan(r: IzvuceniRed): boolean {
    if (!r.hotel?.trim() || !r.room_type?.trim() || !r.board_type?.trim()) return false;
    if (!Number.isInteger(r.price_minor_units) || r.price_minor_units <= 0) return false;
    const od = new Date(r.stay_from);
    const doo = new Date(r.stay_to);
    if (Number.isNaN(od.getTime()) || Number.isNaN(doo.getTime())) return false;
    if (doo <= od) return false;
    return true;
  }

  /** §4.2.3 — poklapanje hotela radi kod, ne model (vidi `hotel-matching.ts`). */
  private async upisiRedove(importId: string, supplierId: string, redovi: IzvuceniRed[]) {
    // Kandidati su proizvodi TOG dobavljača — kroz ugovor ili direktno. Poređenje sa celim
    // katalogom bi lako poklopilo istoimeni hotel drugog dobavljača (M3 §2.9f).
    const proizvodi = await this.prisma.product.findMany({
      where: {
        OR: [{ supplierId }, { sourceContract: { supplierId } }],
      },
      select: {
        id: true,
        destinationCity: true,
        destinationCountry: true,
        translations: { where: { languageCode: 'sr' }, select: { name: true }, take: 1 },
      },
    });
    const kandidati = proizvodi.map((p) => ({
      id: p.id,
      destinationCity: p.destinationCity,
      destinationCountry: p.destinationCountry,
      naziv: p.translations[0]?.name ?? '',
    }));

    for (const r of redovi) {
      const najbolji = nadjiNajbolji(r.hotel, kandidati);
      const automatski =
        najbolji && najbolji.ocena >= PRAG_AUTOMATSKOG_POKLAPANJA ? najbolji.kandidat.id : null;

      await this.prisma.pricelistImportRow.create({
        data: {
          pricelistImportId: importId,
          extractedHotelName: r.hotel,
          // Predlog ispod praga se NE upisuje kao poklapanje — ocena se svejedno čuva da čovek
          // na ekranu vidi koliko je bilo blizu (§4.2.3).
          matchedProductId: automatski,
          matchConfidence: najbolji ? najbolji.ocena : null,
          extractedRoomType: r.room_type,
          extractedBoardType: r.board_type,
          extractedOccupancy: r.occupancy,
          extractedStayFrom: new Date(r.stay_from),
          extractedStayTo: new Date(r.stay_to),
          extractedPrice: r.price_minor_units,
          extractedCurrency: r.currency,
          extractedPriceBasis: r.price_basis ?? null,
          extractedCribFeePerNight: r.crib_fee_per_night ?? null,
          extractedAgePricing: r.age_pricing?.length ? (r.age_pricing as object) : undefined,
        },
      });
    }
  }
}
