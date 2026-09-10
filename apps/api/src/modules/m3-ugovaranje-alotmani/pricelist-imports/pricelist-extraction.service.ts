import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { isAbsolute, join } from 'path';
import {
  AgeCategory,
  AgePricingMode,
  PricelistExtractionPath,
  PricelistImport,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { ExtractFileService } from '../../m15-ai-orkestracija/omnisearch/extract-file.service';
import { PRAG_AUTOMATSKOG_POKLAPANJA, nadjiNajbolji } from './hotel-matching';
import {
  MAX_ZNAKOVA_TEKSTA,
  MIN_KORISNOG_TEKSTA,
  PRICELIST_STORAGE_ENV,
  jeSlika,
  mediaTypeSlike,
  porukaZaPrevelikTekst,
  storageDir,
  tekstJeUpotrebljiv,
} from './pricelist-storage';

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

/**
 * §4.2.7 — blokovi koje saljemo modelu. `text` za nalepljen/izvucen tekst, `document` za
 * skeniran PDF, `image` za fotografiju cenovnika.
 */
type ModelBlok =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/webp';
        data: string;
      };
    };

/**
 * §4.2.8 (v1.37) — ono što model vraća: kombinacija opisana JEDNOM, sa nizom perioda.
 *
 * Stara šema je tražila jedan zapis po periodu, pa je model za cenovnik sa 4 kombinacije i 9
 * sezona ispisivao naziv hotela, sobu, uslugu, popunjenost, valutu, krevetac i uzrasnu cenu
 * 36 puta — menjala su se samo dva datuma i jedan broj. Izmereno: 72% izlaznih tokena je
 * odlazilo na to ponavljanje, a na cenovniku sa 117 redova odgovor je bivao PREKINUT na pola
 * i uvoz je vraćao nulu uz punu naplatu.
 */
interface IzvucenaKombinacija {
  hotel: string;
  room_type: string;
  board_type: string;
  occupancy: string;
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
  periodi?: { od: string; do: string; cena: number }[];
}

/**
 * Jedan red pripremljen za `PricelistImportRow`. Model ovo VIŠE NE PIŠE — kod ga dobija
 * raspakivanjem kombinacije po periodima (§4.2.8). Oblik je namerno ostao nepromenjen: sve
 * provere i poklapanje hotela ispod rade nad njim isto kao pre.
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
 * §4.2.8 — KOD umnožava kombinaciju po periodima. Ovo je deo koji je ranije radio model, i
 * jedini razlog zbog kog ga je radio bio je oblik šeme, ne potreba.
 *
 * Kombinacija bez ijednog perioda se odbacuje ovde, ne kasnije: bez datuma nema cenovne
 * stavke, a red bez datuma bi na ekranu izgledao kao podatak.
 */
export function raspakujKombinacije(kombinacije: IzvucenaKombinacija[]): IzvuceniRed[] {
  return kombinacije.flatMap((k) =>
    (k.periodi ?? []).map((p) => ({
      hotel: k.hotel,
      room_type: k.room_type,
      board_type: k.board_type,
      occupancy: k.occupancy,
      currency: k.currency,
      price_basis: k.price_basis ?? null,
      crib_fee_per_night: k.crib_fee_per_night ?? null,
      age_pricing: k.age_pricing,
      stay_from: p?.od,
      stay_to: p?.do,
      price_minor_units: p?.cena,
    })),
  );
}

/**
 * Model odgovara ISKLJUČIVO kroz ovaj alat, ne slobodnim tekstom (§4.2.6). Slobodan tekst koji
 * treba pretvoriti u cenu je mesto gde greška ulazi tiho — šema odbija sve što nije broj tamo
 * gde broj mora biti.
 *
 * §4.2.8 — šema sada SPROVODI pravilo koje je ranije stajalo samo kao rečenica u uputstvu
 * („nikad dva reda za istu kombinaciju"). Ograda koja postoji u strukturi se ne može prekršiti;
 * ograda koja postoji samo kao podsećanje se pre ili kasnije prekrši.
 */
const ALAT = {
  name: 'upisi_kombinacije_cenovnika',
  description:
    'Vraća kombinacije iz cenovnika. Jedna kombinacija = hotel + tip sobe + usluga + popunjenost, ' +
    'sa nizom perioda i cena ispod nje. NIKAD ne ponavljaj istu kombinaciju za drugi period.',
  input_schema: {
    type: 'object' as const,
    properties: {
      kombinacije: {
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
            periodi: {
              type: 'array',
              description: 'Svaki period ove kombinacije, sa svojom cenom za taj period.',
              items: {
                type: 'object',
                properties: {
                  od: { type: 'string', description: 'Početak perioda, oblik GGGG-MM-DD' },
                  do: { type: 'string', description: 'Kraj perioda, oblik GGGG-MM-DD' },
                  cena: {
                    type: 'integer',
                    description:
                      'Cena u NAJMANJOJ jedinici valute: 89,50 EUR = 8950. Nikad decimalan broj.',
                  },
                },
                required: ['od', 'do', 'cena'],
              },
            },
          },
          required: ['hotel', 'room_type', 'board_type', 'occupancy', 'currency', 'periodi'],
        },
      },
    },
    required: ['kombinacije'],
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
    private readonly config: ConfigService,
    private readonly extractFile: ExtractFileService,
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
    if (!uvoz.sourceText && !uvoz.sourceFileUrl) {
      return this.oznaciNeuspeh(
        importId,
        'Ovaj uvoz nema ni nalepljen tekst ni učitan fajl — nema šta da se pročita.',
      );
    }
    if (!this.anthropic.isConfigured()) {
      return this.oznaciNeuspeh(
        importId,
        'AI ekstrakcija trenutno nije dostupna (ANTHROPIC_API_KEY nije podešen na serveru).',
      );
    }

    try {
      // §4.2.7 — sadržaj se pripremi PRE poziva: nalepljen tekst ide kakav jeste, fajl prolazi
      // kroz parser, a fajl iz kog parser ne izvuče upotrebljiv tekst ide modelu kao dokument.
      const sadrzaj = await this.pripremiSadrzaj(uvoz);
      // `extraction_path` se upisuje samo kad postoji fajl — kod nalepljenog teksta pitanje
      // "ko je čitao" nema smisla, i `null` to kaže tačnije od bilo koje vrednosti enuma.
      if (uvoz.sourceFileUrl) {
        await this.prisma.pricelistImport.update({
          where: { id: importId },
          data: { extractionPath: sadrzaj.path },
        });
      }
      const redovi = await this.pozoviModel(sadrzaj.blokovi, uvoz.supplierId);
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

  /**
   * §4.2.7 — priprema sadrzaja PRE poziva modelu, i odluka ko ga je citao.
   *
   * Redosled je namerno "parser pa model", ne obrnuto: parser je besplatan i determinstican, pa
   * se model placa samo kad parser ne moze. Skeniran PDF se prepoznaje po tome sto parser iz
   * njega vrati prazan tekst — ne postavlja se pitanje "da li je ovo skenirano", na koje bi se
   * ionako odgovaralo pogadjanjem.
   */
  private async pripremiSadrzaj(
    uvoz: PricelistImport,
  ): Promise<{ blokovi: ModelBlok[]; path: PricelistExtractionPath }> {
    if (!uvoz.sourceFileUrl) {
      // Ista granica važi i za nalepljen tekst — čovek ume da nalepi ceo katalog jednako kao
      // što ume da ga otpremi, a trošak i ishod su isti.
      if ((uvoz.sourceText ?? '').length > MAX_ZNAKOVA_TEKSTA) {
        throw new Error(porukaZaPrevelikTekst((uvoz.sourceText ?? '').length));
      }
      return {
        blokovi: [
          {
            type: 'text',
            text: `Tekst cenovnika:

${uvoz.sourceText ?? ''}`,
          },
        ],
        path: PricelistExtractionPath.PARSER,
      };
    }

    const bafer = await readFile(this.punaPutanja(uvoz.sourceFileUrl));
    const ime = uvoz.sourceFileName ?? uvoz.sourceFileUrl;

    // Slika nema parser — ide modelu odmah, bez pokusaja koji bi sigurno pao.
    if (jeSlika(uvoz.sourceFormat)) {
      return {
        blokovi: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaTypeSlike(ime),
              data: bafer.toString('base64'),
            },
          },
          { type: 'text', text: 'Ovo je slika cenovnika. Izvuci redove iz nje.' },
        ],
        path: PricelistExtractionPath.MODEL,
      };
    }

    let izvucen = '';
    try {
      izvucen = (await this.extractFile.extractText(bafer, ime)).text;
    } catch (err) {
      // Parser koji je pao nije kraj puta ako je fajl PDF — model ga jos uvek moze procitati.
      // Za ostale formate greska parsera JESTE kraj, i njena poruka je korisnija od nase.
      this.logger.warn(`Parser nije uspeo nad "${ime}": ${(err as Error).message}`);
      if (uvoz.sourceFormat !== 'PDF') throw err;
    }

    // §4.2.8 — granica se meri nad IZVUČENIM tekstom, ne nad fajlom na disku. Excel se pakuje,
    // pa 1 MB na disku ume da da 2,1 miliona znakova (izmereno nad Solvex katalogom).
    if (izvucen.length > MAX_ZNAKOVA_TEKSTA) {
      throw new Error(porukaZaPrevelikTekst(izvucen.length));
    }

    if (tekstJeUpotrebljiv(izvucen)) {
      return {
        blokovi: [
          {
            type: 'text',
            text: `Tekst cenovnika:

${izvucen}`,
          },
        ],
        path: PricelistExtractionPath.PARSER,
      };
    }

    if (uvoz.sourceFormat !== 'PDF') {
      throw new Error(
        `Iz fajla "${ime}" nije izvučen upotrebljiv tekst (manje od ${MIN_KORISNOG_TEKSTA} znakova). ` +
          'Proveri da dokument nije prazan ili zaštićen lozinkom.',
      );
    }

    // Skeniran PDF: ceo fajl ide modelu, bez OCR biblioteke (§4.2.7).
    return {
      blokovi: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: bafer.toString('base64') },
        },
        {
          type: 'text',
          text: 'Ovo je skenirani cenovnik — u njemu nema teksta nego slike strana. Izvuci redove iz njega.',
        },
      ],
      path: PricelistExtractionPath.MODEL,
    };
  }

  /**
   * §4.2.7 — `source_file_url` nosi putanju RELATIVNU na `PRICELIST_STORAGE_DIR`. Zapisi
   * napravljeni pre te dopune mogu nositi apsolutnu putanju, pa se i ona prihvata: stariji
   * zapis ne sme da postane necitljiv zbog promene koja je dosla posle njega.
   */
  private punaPutanja(sacuvano: string): string {
    if (isAbsolute(sacuvano)) return sacuvano;
    return join(storageDir(this.config.get<string>(PRICELIST_STORAGE_ENV)), sacuvano);
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
  private async pozoviModel(blokovi: ModelBlok[], supplierId: string): Promise<IzvuceniRed[]> {
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
      // §4.2.8 — pravilo 6 je promenjeno zajedno sa šemom: kombinacija se opisuje jednom, sa
      // svim svojim periodima. Cilj je isti kao pre (nikad dva zapisa za istu kombinaciju),
      // ali ga sada sprovodi sama struktura, ne podsećanje u rečenici.
      '(6) JEDNA KOMBINACIJA = hotel + tip sobe + usluga + popunjenost. SVI njeni periodi idu ' +
      'u niz periodi TE kombinacije — nikad ne pravi drugu kombinaciju za drugi period. Dečja ' +
      'cena ide u age_pricing kombinacije, ne u zaseban zapis; ' +
      '(7) doplate (krevetac, dodatni ležaj) NISU zasebna kombinacija — krevetac ide isključivo ' +
      'u polje crib_fee_per_night kombinacije na koju se odnosi; ' +
      '(8) u polje hotel upiši SAMO naziv objekta, bez mesta i bez države — „Hotel Splendid, Bečići" ' +
      'je „Hotel Splendid".';

    const client = this.anthropic.getClient();
    // §4.2.7 — jedini poziv u sistemu na HEAVY tier, vlasnikova odluka: cita se skenirani
    // dokument, a greska ovde je pogresna prodajna cena, ne kozmetika.
    const model = AnthropicClientService.HEAVY_MODEL;
    const poruka: ModelBlok[] = nagovestaj
      ? [...blokovi, { type: 'text', text: nagovestaj }]
      : blokovi;
    const odgovor = await client.messages.create({
      model,
      // §4.2.8 — podignuto sa 8.192. Najveći izmereni cenovnik (117 redova) grupisanom šemom
      // troši 4.648 izlaznih tokena; ovo nosi zalihu za oko četiri puta veći dokument.
      max_tokens: 16000,
      system,
      tools: [ALAT],
      tool_choice: { type: 'tool', name: ALAT.name },
      messages: [{ role: 'user', content: poruka as never }],
    });

    await this.zabeleziPoziv(odgovor, model);

    // §4.2.8 — PREKID ZBOG DUŽINE SE PRIJAVLJUJE KAO PREKID.
    //
    // Ovo je bio stvaran kvar, izmeren 10.9.2026 nad `Primeri cenovnika/Bellevue Rates 2025_hr.pdf`:
    // odgovor bude presečen na pola nedovršenog poziva alata, `input` ostane prazan, i uvoz je
    // padao sa porukom „AI nije prepoznao nijedan red u ovom tekstu" — tačan simptom, pogrešan
    // uzrok, i uputstvo koje čoveka šalje da traži grešku u dokumentu koji je ispravan.
    if (odgovor.stop_reason === 'max_tokens') {
      throw new Error(
        'cenovnik je prevelik da stane u jedan prolaz (odgovor je prekinut zbog dužine). ' +
          'Podeli dokument na manje delove — npr. po hotelu ili po sezoni — i uvezi ih redom.',
      );
    }

    const alat = odgovor.content.find((b: { type: string }) => b.type === 'tool_use') as
      { input?: { kombinacije?: IzvucenaKombinacija[] } } | undefined;
    // §4.2.8 — od ove tačke nadalje ništa se ne menja: raspakovan red ima isti oblik kao pre,
    // pa sve provere i poklapanje hotela ispod rade nad njim identično.
    return raspakujKombinacije(alat?.input?.kombinacije ?? []);
  }

  private async zabeleziPoziv(
    odgovor: { usage: { input_tokens: number; output_tokens: number } },
    model: string,
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { agentRole: 'PRICELIST_IMPORT_AGENT' },
    });
    if (!agent) return;
    await this.invocationLog.record({
      agentId: agent.id,
      actionCode: 'pricelist_import.extract',
      // Tier se izvodi iz modela koji je STVARNO pozvan, ne iz registra agenta. Izmereno
      // 10.9.2026: registar je nosio LIGHT, poziv je isao na opus-5, i dnevnik potrosnje je
      // prijavljivao tier koji se ne slaze sa cenom — a M18 §6.5 na tom tieru gradi degradaciju.
      requestedTier: 'HEAVY',
      securityCritical: false,
      modelIdentifier: model,
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
