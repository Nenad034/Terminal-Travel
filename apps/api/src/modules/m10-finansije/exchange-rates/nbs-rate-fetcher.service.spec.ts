import { NbsRateFetcherService } from './nbs-rate-fetcher.service';

// Isečak stvarne NBS stranice (webappcenter.nbs.rs), snimljen ručno avgust 2026 —
// M10 spec §11. Namerno sadrži samo relevantne redove, ostatak tabele (druge valute) nije
// bitan za parser, koji traži samo EUR/USD (TRACKED_CURRENCIES).
const SAMPLE_HTML = `
<html><body>
<center><h6> &#x41A;&#x423;&#x420;&#x421;&#x41D;&#x410; &#x41B;&#x418;&#x421;&#x422;&#x410; &#x411;&#x420;. 153</h6></center>
<center><h6> &#x424;&#x41E;&#x420;&#x41C;&#x418;&#x420;&#x410;&#x41D;&#x410; &#x41D;&#x410; &#x414;&#x410;&#x41D; 14.8.2026. &#x413;&#x41E;&#x414;&#x418;&#x41D;&#x415;</h6></center>
<table>
<tbody>
<tr>
    <td>EUR</td>
    <td>978</td>
        <td>&#x415;&#x41C;&#x423;</td>
    <td>1</td>
    <td>117,3433</td>
</tr>
<tr>
    <td>AUD</td>
    <td>36</td>
        <td>&#x410;&#x443;&#x441;&#x442;&#x440;&#x430;&#x43B;&#x438;&#x458;&#x430;</td>
    <td>1</td>
    <td>71,8047</td>
</tr>
<tr>
    <td>USD</td>
    <td>840</td>
        <td>&#x410;&#x43C;&#x435;&#x440;&#x438;&#x43A;&#x430;</td>
    <td>1</td>
    <td>101,6575</td>
</tr>
<tr>
    <td>JPY</td>
    <td>392</td>
        <td>&#x408;&#x430;&#x43F;&#x430;&#x43D;</td>
    <td>100</td>
    <td>68,9012</td>
</tr>
</tbody>
</table>
</body></html>
`;

describe('NbsRateFetcherService.parse (M10 spec §11 — javna NBS stranica)', () => {
  const service = new NbsRateFetcherService();

  it('parsira datum kursne liste iz "ФОРМИРАНА НА ДАН" naslova', () => {
    const page = service.parse(SAMPLE_HTML);
    expect(page.rateDate.toISOString().slice(0, 10)).toBe('2026-08-14');
  });

  it('parsira EUR/USD kurs sa decimalnom zapetom, jedinica = 1', () => {
    const page = service.parse(SAMPLE_HTML);
    expect(page.rows).toContainEqual({ currency: 'EUR', rate: 117.3433 });
    expect(page.rows).toContainEqual({ currency: 'USD', rate: 101.6575 });
  });

  it('ne parsira valute van TRACKED_CURRENCIES (npr. AUD/JPY se ignorišu)', () => {
    const page = service.parse(SAMPLE_HTML);
    expect(page.rows.map((r) => r.currency).sort()).toEqual(['EUR', 'USD']);
  });

  it('svodi kurs sa jedinicom različitom od 1 na "za 1 jedinicu" (npr. 100 JPY)', () => {
    // JPY nije praćena valuta, ali proveravamo istu logiku deljenja jedinicom na EUR sa
    // veštački izmenjenim redom da jedinica != 1 (100 EUR = 11734,33) i dalje da tačan rezultat.
    const html = SAMPLE_HTML.replace(
      '<td>EUR</td>\n    <td>978</td>\n        <td>&#x415;&#x41C;&#x423;</td>\n    <td>1</td>\n    <td>117,3433</td>',
      '<td>EUR</td>\n    <td>978</td>\n        <td>&#x415;&#x41C;&#x423;</td>\n    <td>100</td>\n    <td>11734,33</td>',
    );
    const page = service.parse(html);
    const eur = page.rows.find((r) => r.currency === 'EUR');
    expect(eur?.rate).toBeCloseTo(117.3433, 4);
  });

  it('baca grešku kad datum kursne liste nije pronađen (format stranice se promenio)', () => {
    expect(() => service.parse('<html><body>nema tabele ovde</body></html>')).toThrow(
      /Datum kursne liste nije pronađen/,
    );
  });

  it('baca grešku kad nijedna praćena valuta nije pronađena', () => {
    const html = SAMPLE_HTML.replace(/EUR/g, 'XXX').replace(/USD/g, 'YYY');
    expect(() => service.parse(html)).toThrow(/Nijedna praćena valuta/);
  });
});
