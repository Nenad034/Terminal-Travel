/**
 * M3 spec §2.11b — provere nad datumskim opsezima sezona.
 *
 * Izdvojeno iz servisa namerno: ovo je jedina logika koja odlučuje da li jedan datum pripada
 * tačno jednoj koloni cenovnika. Ako dva opsega pokriju isti dan, cena za taj dan postaje
 * dvosmislena — a to se ne vidi na ekranu, nego tek kad pretraga vrati dve različite ponude
 * za isti termin. Zato ima sopstvene testove, bez baze.
 */

export interface Opseg {
  dateFrom: string | Date;
  dateTo: string | Date;
}

export interface SezonaSaOpsezima {
  id?: string;
  code: string;
  ranges: Opseg[];
}

/** Datum bez vremena, u UTC — cenovnik radi sa danima, ne sa trenucima. */
export function danUtc(v: string | Date): number {
  const d = v instanceof Date ? v : new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Dva opsega se seku ako se dodiruju bilo kojim danom (granice uključene). */
export function opseziSeSeku(a: Opseg, b: Opseg): boolean {
  return danUtc(a.dateFrom) <= danUtc(b.dateTo) && danUtc(b.dateFrom) <= danUtc(a.dateTo);
}

export interface GreskaOpsega {
  poruka: string;
}

/**
 * Provera jedne sezone pre upisa, u kontekstu ostalih sezona istog ugovora.
 *
 * `ostale` NE sme da sadrži sezonu koja se upravo menja — pozivalac je izuzima po `id`,
 * inače bi svaka izmena padala na preklapanju sa samom sobom.
 */
export function proveriSezonu(
  sezona: SezonaSaOpsezima,
  ostale: SezonaSaOpsezima[],
): GreskaOpsega | null {
  if (sezona.ranges.length === 0) {
    return { poruka: 'Sezona mora imati bar jedan datumski opseg.' };
  }

  for (const r of sezona.ranges) {
    if (danUtc(r.dateFrom) > danUtc(r.dateTo)) {
      return { poruka: `Opseg ${iso(r.dateFrom)} – ${iso(r.dateTo)} počinje posle svog kraja.` };
    }
  }

  // Unutar iste sezone: dva opsega koja se seku znače da je isti dan dvaput u istoj koloni.
  for (let i = 0; i < sezona.ranges.length; i++) {
    for (let j = i + 1; j < sezona.ranges.length; j++) {
      if (opseziSeSeku(sezona.ranges[i], sezona.ranges[j])) {
        return {
          poruka: `Opsezi ${iso(sezona.ranges[i].dateFrom)} – ${iso(sezona.ranges[i].dateTo)} i ${iso(
            sezona.ranges[j].dateFrom,
          )} – ${iso(sezona.ranges[j].dateTo)} se preklapaju unutar iste sezone.`,
        };
      }
    }
  }

  // Između sezona: isti dan u dve kolone znači dve cene za isti datum.
  for (const druga of ostale) {
    for (const a of sezona.ranges) {
      for (const b of druga.ranges) {
        if (opseziSeSeku(a, b)) {
          return {
            poruka: `Opseg ${iso(a.dateFrom)} – ${iso(a.dateTo)} se preklapa sa sezonom „${druga.code}" (${iso(
              b.dateFrom,
            )} – ${iso(b.dateTo)}). Jedan datum sme pripadati samo jednoj sezoni.`,
          };
        }
      }
    }
  }

  return null;
}

function iso(v: string | Date): string {
  return new Date(danUtc(v)).toISOString().slice(0, 10);
}
