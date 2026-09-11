import { BadRequestException } from '@nestjs/common';
import {
  BedCombinationOverride,
  izvediMatricu,
  kljucKombinacije,
  primeniOdstupanja,
} from '../../m2-katalog-proizvoda/products/bed-combinations';

/**
 * M5 spec §3.2a (dopuna 10.9.2026) — „`room_config` mora proći i kroz `M2
 * room_types[].bed_combinations[]`: soba može fizički primiti „1 odrasla + 2 deteta", a da hotel
 * tu kombinaciju ne dozvoljava."
 *
 * Matrica se NE izvodi ovde ponovo — koristi se ista funkcija koju zove i ekran za unos u
 * katalogu (M2 §2.3g). To je bio razlog što je izvođenje uopšte stavljeno na jedno mesto: da
 * ekran ne bi nudio raspored koji prodaja odbija.
 */

export interface BedsDefinition {
  baseBeds: number;
  extraBedsMax: number | null;
  /** M2 §2.3b — maks. uzrast deteta koje sme na POMOĆNI krevet. `null` = bez ograničenja. */
  extraBedMaxAge: number | null;
  /** M2 §2.3b — maks. uzrast deteta koje sme da DELI krevet. `null` = soba to ne dozvoljava. */
  sharesBedMaxAge: number | null;
}

export interface BedFitInput {
  adults: number;
  childrenAges: number[];
  minOccupancy?: number | null;
  beds?: BedsDefinition | null;
  bedCombinations?: BedCombinationOverride[] | null;
  /** Za poruku — šifra sobe. */
  roomTypeCode: string;
}

/**
 * Proverava da li grupa staje u sobu po matrici kombinacija.
 *
 * **Dete mlađe od `shares_bed_max_age` ne zauzima krevet** — to je svojstvo SOBE (M2 §2.3b
 * uloga „dete koje deli krevet": _„ne zauzima krevet; povećava broj osoba, ne broj kreveta"_),
 * ne odstupanje koje neko mora posebno uneti. Da je obrnuto, beba u sobi sa dve odrasle osobe i
 * dva kreveta bila bi odbijena svuda dok neko ručno ne unese pravilo — a danas nijedan proizvod
 * nema nijedno (izmereno 11.9.2026: 0 zapisa u `bed_combinations[]` na 225 soba).
 * `shared_bed_children` iz odstupanja je DODATNA dozvola povrh te uzrasne granice, kako §2.3g i
 * kaže („koliko dece uz ovu kombinaciju sme **dodatno** da deli krevet").
 *
 * Deljenje je mogućnost, ne obaveza: dete koje sme da deli krevet i dalje sme da zauzme svoj ako
 * ga ima. Zato se prolazi kroz sve podele i prihvata **bilo koja** koja prolazi — grupa se odbija
 * tek kad nijedan raspored ne radi.
 *
 * Redosled u `children_ages[]` ne utiče na ishod: krevet dele NAJMLAĐA deca, a na pomoćne
 * krevete idu najmlađa od preostalih. Isti princip kao §3.2b korak 1 — redosled kojim je
 * prodavac ukucao godine ne sme da menja rezultat.
 */
export function assertBedCombinationAllowed(ulaz: BedFitInput): void {
  const beds = ulaz.beds;
  // Soba bez unetih kreveta ne može ništa da tvrdi. Ovo NIJE tiho propuštanje kao `capacity: 99`
  // (zamka 7.14): kapacitet se i dalje proverava odvojeno preko `assertRoomCapacity`, ovde otpada
  // samo provera rasporeda, i to zato što podatka nema — ne zato što je nezgodan.
  if (!beds || beds.baseBeds <= 0) return;

  const matrica = primeniOdstupanja(
    izvediMatricu(
      { base_beds: beds.baseBeds, extra_beds_max: beds.extraBedsMax },
      ulaz.minOccupancy ?? null,
    ),
    ulaz.bedCombinations,
  );
  if (matrica.length === 0) return;

  const uzrasti = [...ulaz.childrenAges].sort((a, b) => a - b); // najmlađe prvo
  const ukupnoDece = uzrasti.length;
  const smeDaDeli =
    beds.sharesBedMaxAge == null ? 0 : uzrasti.filter((g) => g <= beds.sharesBedMaxAge!).length;

  let razlogPoslednjeg: string | null = null;

  for (let delilaca = 0; delilaca <= ukupnoDece; delilaca++) {
    const naKrevetu = ukupnoDece - delilaca;
    const red = matrica.find((r) => r.key === kljucKombinacije(ulaz.adults, naKrevetu));
    if (!red) {
      razlogPoslednjeg ??= `soba ${ulaz.roomTypeCode} ne prima ${ulaz.adults} ${ulaz.adults === 1 ? 'odraslu osobu' : 'odraslih'} i ${ukupnoDece} ${ukupnoDece === 1 ? 'dete' : 'dece'} — nema toliko ležajnih mesta`;
      continue;
    }
    if (!red.allowed) {
      razlogPoslednjeg = `hotel ne dozvoljava kombinaciju ${red.key} u sobi ${ulaz.roomTypeCode}${red.note ? ` (${red.note})` : ''}`;
      continue;
    }
    if (delilaca > smeDaDeli + red.shared_bed_children) continue;

    // Deca koja su ostala na krevetima su NAJSTARIJA (najmlađa dele). Od njih na pomoćne krevete
    // idu najmlađa — tako raspored najviše puta prolazi uzrasnu granicu pomoćnog kreveta.
    const naKrevetima = uzrasti.slice(delilaca);
    const naPomocnom = naKrevetima.slice(0, red.decaNaPomocnom);
    if (beds.extraBedMaxAge != null && naPomocnom.some((g) => g > beds.extraBedMaxAge!)) {
      razlogPoslednjeg = `u sobi ${ulaz.roomTypeCode} na pomoćni krevet sme dete do ${beds.extraBedMaxAge} godina, a raspored bi tamo smestio dete od ${Math.max(...naPomocnom)}`;
      continue;
    }
    return; // našao se raspored koji prolazi
  }

  throw new BadRequestException(
    `${razlogPoslednjeg ?? `soba ${ulaz.roomTypeCode} ne prima traženu grupu`} (M2 spec §2.3g).`,
  );
}
