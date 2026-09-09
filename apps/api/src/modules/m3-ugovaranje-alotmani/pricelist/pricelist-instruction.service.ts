import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { PricelistVersionsService } from './pricelist-versions.service';
import { Namera, StavkaCenovnika, primeniNamere } from './instruction-intents';
import { PricelistInstructionDto } from './dto/pricelist-instruction.dto';

/**
 * M3 spec §4.8 — izmena cenovnika rečima.
 *
 * Vlasnik: _„omogućio bih da AI agent ima sposobnost da mu kažemo šta treba da izmeni kada su
 * manje izmene… da to izmeni, prikaže, sačeka naše odobrenje i primeni izmene."_
 *
 * Ovo je **drugi ulaz u isti tok**, ne nov tok: rečenica se pretvara u predlog, predlog ide kroz
 * `PricelistVersionsService` (§2.11l) i završava kao spisak razlika koji čovek odobrava red po
 * red. Primena ide **istim** endpoint-om kao uvoz dokumenta, sa `instructionText` u telu.
 *
 * **Podela posla** (§4.8.1 korak 3, M15 princip „kod radi najviše posla"): model prevodi rečenicu
 * u **nameru** i ništa više; koje su tačno stavke pogođene i kolika je nova cena računa
 * deterministički kod (`instruction-intents.ts`). Spec to izričito traži — model ume da pogreši u
 * aritmetici samouvereno, a pogrešna nabavna cena ne pravi buku nego tiho menja maržu.
 *
 * **Nivo autonomije `PROPOSE_THEN_APPROVE`** (§4.8.2): ovaj servis **ne upisuje ništa**, nikad.
 * Nema nijedan `create`/`update` poziv — samo čita cenovnik i vraća predlog.
 */
@Injectable()
export class PricelistInstructionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
    private readonly verzije: PricelistVersionsService,
  ) {}

  async predlozi(contractId: string, dto: PricelistInstructionDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Ugovor nije pronađen.');

    const recenica = dto.instructionText.trim();
    if (!recenica) throw new BadRequestException('Rečenica je prazna.');

    // Redosled je namerno ovakav: prvo se proverava IMA LI šta da se menja, pa tek onda da li je
    // AI servis podešen. Prazan cenovnik je stvar zahteva, ne instalacije — i na instalaciji sa
    // podešenim AI servisom nema smisla poslati prazan cenovnik modelu.
    const zatecene = (await this.verzije.zateceniRedovi(contractId)) as StavkaCenovnika[];
    if (zatecene.length === 0) {
      throw new BadRequestException(
        'Cenovnik je prazan — nema šta da se izmeni. Unesite cene pre nego što tražite izmenu rečima.',
      );
    }

    if (!this.anthropic.isConfigured()) {
      // Ista granica kao kod uvoza (§4.2.6): bez podešenog AI servisa se ne pretvara da radi.
      throw new BadRequestException(
        'AI servis nije podešen na ovoj instalaciji, pa se izmena rečima ne može pripremiti. ' +
          'Izmenu možete uneti ručno u mreži cena (M3 spec §4.8).',
      );
    }

    const doplate = await this.prisma.ancillaryService.findMany({
      where: { contractId, status: 'ACTIVE' },
      include: { season: true },
    });

    const { namere, pitanja } = await this.pozoviModel(recenica, zatecene, doplate);

    // §4.4 ograda koja važi i ovde: nejasan zahtev se PITA, ne pogađa. Kad model ima pitanje,
    // predlog se ne pravi — jedna pogrešno shvaćena rečenica inače prolazi kao četrnaest ispravnih.
    if (pitanja.length > 0 && namere.length === 0) {
      return {
        contractId,
        instructionText: recenica,
        pitanja,
        namere: [],
        razlike: [],
        ukupno: 0,
        sviKljucevi: [] as string[],
        redovi: [] as StavkaCenovnika[],
        neprimenjeno: [] as { obrazlozenje: string; razlog: string }[],
        noveDoplate: [] as unknown[],
        ugaseneDoplate: [] as string[],
      };
    }

    const rezultat = primeniNamere(zatecene, namere);

    // Isti proračun razlike koji koristi i uvoz dokumenta — bez druge putanje do istog ekrana.
    const predlog = await this.verzije.predlozi(contractId, {
      effectiveFrom: dto.effectiveFrom,
      redovi: rezultat.redovi as any,
    } as any);

    return {
      contractId,
      instructionText: recenica,
      /** Pitanja modela kad rečenica nije jednoznačna — prikazuju se uz predlog. */
      pitanja,
      /** Šta je model razumeo, rečenicu po rečenicu — čovek proverava razumevanje, ne samo ishod. */
      namere: namere.map((n) => ({ vrsta: n.vrsta, obrazlozenje: n.obrazlozenje })),
      razlike: predlog.razlike,
      ukupno: predlog.ukupno,
      sviKljucevi: predlog.sviKljucevi,
      /** Redovi koji se šalju nazad pri primeni — isti oblik kao kod uvoza dokumenta. */
      redovi: rezultat.redovi,
      /** Izmene koje ovaj tok ne ume da primeni — prijavljuju se, ne ćute se (§4.8.2). */
      neprimenjeno: rezultat.neprimenjeno,
      /** Doplate koje bi trebalo dodati; menjaju se na ekranu doplata (§2.11k). */
      noveDoplate: rezultat.noveDoplate,
      ugaseneDoplate: rezultat.ugaseneDoplate,
    };
  }

  // ──────────────────────────────────────────────────────────── model

  private async pozoviModel(
    recenica: string,
    zatecene: StavkaCenovnika[],
    doplate: { name: string; kind: string; season: { code: string } | null }[],
  ): Promise<{ namere: Namera[]; pitanja: string[] }> {
    const sazetak = this.sazetakCenovnika(zatecene, doplate);

    const system =
      'Ti si PricelistEditAgent agencije Terminal Travel. Iz rečenice na srpskom prevodiš šta ' +
      'treba izmeniti u cenovniku u zadatu strukturu i ništa više. Pravila: ' +
      '(1) TI NE RAČUNAŠ. Ako rečenica kaže „gore 5%", vrati vrstu CENA_PROCENAT i procenat 5 — ' +
      'nikad izračunatu cenu. Novi iznosi se računaju kodom; tvoj račun se ne koristi. ' +
      '(2) Jedna izmena iz rečenice = jedna stavka u nizu, i `obrazlozenje` je DEO REČENICE iz ' +
      'kog je nastala, prepisan, ne prepričan. ' +
      '(3) Domet popunjavaš SAMO onim što u rečenici piše. Ako sezona nije pomenuta, ostavi ' +
      'prazan niz — prazno znači „sve", i to je tačno. Ne izmišljaj oznake sezona ni tipove soba ' +
      'kojih nema u priloženom cenovniku. ' +
      '(4) Iznosi idu u NAJMANJOJ jedinici valute: 5 € je 500. ' +
      '(5) Izmenu koju ova struktura ne pokriva (rokovi otkazivanja, akcije/rani buking, ' +
      'kapacitet, uslovi ugovora) vrati kao NEPODRZANO uz kratko objašnjenje na kom se ekranu ' +
      'menja — nikad je ne prećutkuj i nikad je ne pretvaraj u izmenu cene. ' +
      '(6) Ako rečenica nije jednoznačna (ne vidi se na šta se odnosi, ili nedostaje iznos), ' +
      'upiši pitanje u `pitanja` umesto da pogađaš. ' +
      '(7) Ti ništa ne upisuješ u sistem — svaka izmena ide čoveku na odobrenje, pojedinačno.';

    const client = this.anthropic.getClient();
    const odgovor = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 2048,
      system,
      tools: [ALAT],
      tool_choice: { type: 'tool', name: ALAT.name },
      messages: [
        {
          role: 'user',
          content: `Zatečeni cenovnik:\n\n${sazetak}\n\nTraženo:\n\n${recenica}`,
        },
      ],
    });

    await this.zabeleziPoziv(odgovor);

    const alat = odgovor.content.find((b: { type: string }) => b.type === 'tool_use') as
      { input?: { izmene?: Namera[]; pitanja?: string[] } } | undefined;

    const namere = (alat?.input?.izmene ?? []).filter((n) => this.jeIspravna(n));
    return { namere, pitanja: alat?.input?.pitanja ?? [] };
  }

  /**
   * Cenovnik u tekstu koji model dobija.
   *
   * Namerno **sažetak, ne cela baza**: modelu treba samo ono po čemu prepoznaje domet — oznake
   * sezona, tipovi soba, pansioni, popunjenosti i tekuće cene. Sve preko toga je i trošak i
   * prilika da model pomeša polja.
   */
  private sazetakCenovnika(
    redovi: StavkaCenovnika[],
    doplate: { name: string; kind: string; season: { code: string } | null }[],
  ): string {
    const cene = redovi
      .map(
        (r) =>
          `- sezona ${r.seasonCode} | soba ${r.roomType} | pansion ${r.boardType} | popunjenost ${r.occupancy} | cena ${(r.price / 100).toFixed(2)}`,
      )
      .join('\n');
    if (doplate.length === 0) return cene;
    const dop = doplate
      .map(
        (d) =>
          `- ${d.name} (${d.kind === 'DISCOUNT' ? 'popust' : 'doplata'}${d.season ? `, sezona ${d.season.code}` : ''})`,
      )
      .join('\n');
    return `${cene}\n\nPostojeće doplate i popusti:\n${dop}`;
  }

  /**
   * Provera POSLE modela, ne umesto njega (isto pravilo kao §4.2.6).
   *
   * Šema alata traži tip, ali ne i da procenat postoji kad je vrsta CENA_PROCENAT. Namera bez
   * broja bi u kodu dala `null` i tiho nestala; bolje je da ne stigne ni do predloga.
   */
  private jeIspravna(n: Namera): boolean {
    if (!n?.vrsta || typeof n.obrazlozenje !== 'string' || !n.obrazlozenje.trim()) return false;
    if (n.vrsta === 'CENA_PROCENAT') return typeof n.procenat === 'number' && n.procenat !== 0;
    if (n.vrsta === 'CENA_IZNOS' || n.vrsta === 'CENA_NOVA_VREDNOST') {
      return Number.isInteger(n.iznosMinor);
    }
    return true;
  }

  private async zabeleziPoziv(odgovor: { usage: { input_tokens: number; output_tokens: number } }) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { agentRole: 'PRICELIST_IMPORT_AGENT' },
    });
    if (!agent) return;
    await this.invocationLog.record({
      agentId: agent.id,
      actionCode: 'pricelist.edit_from_instruction',
      requestedTier: agent.modelTier ?? 'LIGHT',
      securityCritical: false,
      modelIdentifier: AnthropicClientService.MODEL,
      inputTokens: odgovor.usage.input_tokens,
      outputTokens: odgovor.usage.output_tokens,
      latencyMs: 0,
    });
  }
}

/**
 * Model odgovara ISKLJUČIVO kroz ovaj alat (§4.8.1 korak 2, isti obrazac kao §4.2.6).
 *
 * Šema namerno **nema polje za izračunatu cenu** — da model ne bi mogao ni da je pošalje. Ograda
 * koja postoji samo kao rečenica u uputstvu se pre ili kasnije prekrši; ograda koja ne postoji u
 * strukturi se ne može prekršiti.
 */
const ALAT = {
  name: 'predlozi_izmene_cenovnika',
  description:
    'Prevodi rečenicu o izmeni cenovnika u spisak namera. Ne računa nove cene — to radi kod.',
  input_schema: {
    type: 'object' as const,
    properties: {
      izmene: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            vrsta: {
              type: 'string',
              enum: [
                'CENA_PROCENAT',
                'CENA_IZNOS',
                'CENA_NOVA_VREDNOST',
                'CENA_GASENJE',
                'DOPLATA_NOVA',
                'DOPLATA_GASENJE',
                'NEPODRZANO',
              ],
              description:
                'CENA_PROCENAT za „gore/dole X%"; CENA_IZNOS za „skuplje za X evra"; ' +
                'CENA_NOVA_VREDNOST za „sada je X evra"; CENA_GASENJE kad se cena ukida; ' +
                'NEPODRZANO za sve što nije cena ni doplata.',
            },
            obrazlozenje: {
              type: 'string',
              description: 'Deo rečenice iz kog je izmena nastala, prepisan doslovno.',
            },
            seasonCodes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Oznake sezona iz cenovnika. Prazno = sve sezone.',
            },
            roomTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tipovi soba iz cenovnika. Prazno = svi.',
            },
            boardTypes: { type: 'array', items: { type: 'string' } },
            occupancies: { type: 'array', items: { type: 'string' } },
            procenat: {
              type: ['number', 'null'],
              description: 'Samo za CENA_PROCENAT: 5 znači poskupljenje 5%, -10 sniženje 10%.',
            },
            iznosMinor: {
              type: ['integer', 'null'],
              description:
                'Samo za CENA_IZNOS i CENA_NOVA_VREDNOST, u najmanjoj jedinici valute: 5 € = 500.',
            },
            nazivDoplate: {
              type: ['string', 'null'],
              description: 'Samo za DOPLATA_GASENJE: naziv doplate koja se ukida.',
            },
            doplata: {
              type: ['object', 'null'],
              description: 'Samo za DOPLATA_NOVA.',
              properties: {
                name: { type: 'string' },
                kind: { type: 'string', enum: ['SURCHARGE', 'DISCOUNT'] },
                pricingMode: {
                  type: 'string',
                  enum: ['FLAT_PER_UNIT', 'PERCENTAGE_OF_NIGHTLY_RATE'],
                },
                flatAmount: { type: ['integer', 'null'] },
                percentageOfNightlyRate: { type: ['number', 'null'] },
                priceBasis: {
                  type: 'string',
                  enum: [
                    'PER_PERSON_PER_NIGHT',
                    'PER_ROOM_PER_NIGHT',
                    'PER_PERSON_PER_STAY',
                    'PER_ROOM_PER_STAY',
                    'PER_PET_PER_NIGHT',
                    'PER_PET_PER_STAY',
                  ],
                },
                payable: {
                  type: 'string',
                  enum: ['AGENCY', 'ON_SITE'],
                  description: 'ON_SITE kad se plaća u hotelu / na licu mesta.',
                },
                isMandatory: { type: 'boolean' },
                seasonCode: { type: ['string', 'null'] },
                appliesToRoomTypes: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'kind', 'pricingMode', 'priceBasis', 'payable', 'isMandatory'],
            },
            nepodrzanoObjasnjenje: {
              type: ['string', 'null'],
              description: 'Samo za NEPODRZANO: na kom ekranu se ta izmena radi.',
            },
          },
          required: ['vrsta', 'obrazlozenje'],
        },
      },
      pitanja: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Pitanja kad rečenica nije jednoznačna. Bolje pitati nego pogoditi — pogrešna cena se ' +
          'otkriva tek kad se sabira zarada.',
      },
    },
    required: ['izmene'],
  },
};
