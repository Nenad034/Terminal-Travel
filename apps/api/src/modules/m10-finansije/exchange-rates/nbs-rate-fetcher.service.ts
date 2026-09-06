import { Injectable, Logger } from '@nestjs/common';

// M10 spec §3.1/§12 — javna NBS stranica sa zvaničnim srednjim kursom, bez potrebne registracije.
// PRIVREMENO rešenje (kao mock SEF/CIS pre potvrde zvaničnog ugovora): zamenjuje se zvaničnim
// SOAP veb-servisom NBS ("Sistem veb-servisa Narodne banke Srbije") čim se registracija sredi —
// vidi M10 spec §11. Format tabele potvrđen ručno avgust 2026, može se promeniti bez najave.
const NBS_MIDDLE_RATE_URL = 'https://webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/CurrentMiddleRate';

// Ista aplikacija, stranica "претрага по датуму" (M10 spec §3.1a, dopuna 6.9.2026). Obična GET
// forma — `Date` u obliku DD.MM.GGGG i `ExchangeRateListTypeID`, bez tokena i bez sesije.
// `3` = SREDNJI kurs; potvrđeno poređenjem, ne pretpostavkom: za 28.8.2026. ova stranica vraća
// EUR 117,3707, identično zapisu koji je dnevni uvoz tog dana upisao u bazu.
const NBS_BY_DATE_URL = 'https://webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/IndexByDate';
const NBS_MIDDLE_RATE_LIST_TYPE = '3';

// Valute koje sistem stvarno koristi (M3 Contract.currency / M10 FiscalDocument) — RSD je
// bazna valuta, ne treba joj sopstveni kurs.
export const TRACKED_CURRENCIES = ['EUR', 'USD'] as const;

export interface NbsRateRow {
  currency: string;
  rate: number; // već svedeno na "za 1 jedinicu" (podeljeno jedinicom sa NBS stranice)
}

export interface NbsRatePage {
  rateDate: Date;
  rows: NbsRateRow[];
}

@Injectable()
export class NbsRateFetcherService {
  private readonly logger = new Logger(NbsRateFetcherService.name);

  async fetchTodaysRates(): Promise<NbsRatePage> {
    const response = await fetch(NBS_MIDDLE_RATE_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`NBS stranica vratila HTTP ${response.status}`);
    }
    const html = await response.text();
    return this.parse(html);
  }

  /**
   * Kursna lista za JEDAN raniji dan (M10 spec §3.1a). Isti parser kao za današnji kurs —
   * stranica po datumu koristi identičan oblik reda i istu oznaku datuma
   * (`ФОРМИРАНА НА ДАН d.m.gggg. ГОДИНЕ`), pa nema grananja.
   *
   * VAŽNO za neradne dane: za datum kad kursna lista nije objavljena (vikend, praznik) NBS
   * vraća poslednju VAŽEĆU listu, ne prazan odgovor — traženo 30.8.2026 (nedelja) vraća listu
   * od 28.8.2026. Zato pozivalac mora da upiše zapis pod `rateDate` KOJI STRANICA JAVI, nikad
   * pod traženim datumom; inače bi vikend dobio izmišljen sopstveni kurs.
   */
  async fetchRatesForDate(date: Date): Promise<NbsRatePage> {
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const url =
      `${NBS_BY_DATE_URL}?isSearchExecuted=true` +
      `&Date=${dd}.${mm}.${date.getUTCFullYear()}` +
      `&ExchangeRateListTypeID=${NBS_MIDDLE_RATE_LIST_TYPE}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`NBS stranica (po datumu) vratila HTTP ${response.status}`);
    }
    return this.parse(await response.text());
  }

  // Izdvojeno iz fetchTodaysRates radi testiranja bez mrežnog poziva — HTML oblik potvrđen
  // ručno (avgust 2026): "ФОРМИРАНА НА ДАН 14.8.2026. ГОДИНЕ" i redovi
  // <td>EUR</td><td>978</td><td>...</td><td>1</td><td>117,3433</td>.
  parse(html: string): NbsRatePage {
    const dateMatch = html.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\.\s*&#x413;&#x41E;&#x414;&#x418;&#x41D;&#x415;/);
    if (!dateMatch) {
      throw new Error('Datum kursne liste nije pronađen na NBS stranici (format stranice se promenio — M10 spec §11).');
    }
    const [, day, month, year] = dateMatch;
    const rateDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    const rows: NbsRateRow[] = [];
    for (const currency of TRACKED_CURRENCIES) {
      const rowMatch = html.match(
        new RegExp(`<td>${currency}</td>\\s*<td>\\d+</td>\\s*<td>[^<]*</td>\\s*<td>(\\d+)</td>\\s*<td>([\\d.,]+)</td>`),
      );
      if (!rowMatch) {
        this.logger.warn(`Valuta ${currency} nije pronađena na NBS stranici — preskačem, ostale valute se svejedno uvoze.`);
        continue;
      }
      const [, unitStr, rateStr] = rowMatch;
      const unit = Number(unitStr);
      const rate = Number(rateStr.replace(/\./g, '').replace(',', '.')) / unit;
      rows.push({ currency, rate });
    }

    if (rows.length === 0) {
      throw new Error('Nijedna praćena valuta (EUR/USD) nije pronađena na NBS stranici — format stranice se verovatno promenio.');
    }

    return { rateDate, rows };
  }
}
