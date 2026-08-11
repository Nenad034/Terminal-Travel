import { buildSoapEnvelope, extractDiffgramRows, extractStarRating, firstDefined, parseSoapResponse, soapActionHeader } from './solvex.soap';

describe('buildSoapEnvelope (M4 spec §5a)', () => {
  it('gradi envelope sa ispravnim namespace-om i redosledom parametara', () => {
    const xml = buildSoapEnvelope('Connect', { login: 'sol611s', password: 'x' });
    expect(xml).toContain('<Connect xmlns="http://www.megatec.ru/">');
    expect(xml).toContain('<login>sol611s</login>');
    expect(xml.indexOf('<login>')).toBeLessThan(xml.indexOf('<password>'));
  });
});

describe('soapActionHeader', () => {
  it('vraća SOAPAction u citiranom obliku sa namespace prefiksom', () => {
    expect(soapActionHeader('Connect')).toBe('"http://www.megatec.ru/Connect"');
  });
});

describe('parseSoapResponse', () => {
  it('vraća <Method>Result sadržaj iz uspešnog odgovora', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ConnectResponse xmlns="http://www.megatec.ru/"><ConnectResult>abc-guid</ConnectResult></ConnectResponse></soap:Body></soap:Envelope>`;
    expect(parseSoapResponse(xml, 'Connect')).toBe('abc-guid');
  });

  it('baca grešku na SOAP Fault', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultstring>Nevalidan zahtev</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
    expect(() => parseSoapResponse(xml, 'Connect')).toThrow(/Nevalidan zahtev/);
  });

  it('parsira listu Country elemenata (GetCountries)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetCountriesResponse xmlns="http://www.megatec.ru/"><GetCountriesResult><Country><Name>BULGARIA</Name><ID>4</ID></Country><Country><Name>GREECE</Name><ID>16</ID></Country></GetCountriesResult></GetCountriesResponse></soap:Body></soap:Envelope>`;
    const result = parseSoapResponse(xml, 'GetCountries') as { Country: { Name: string }[] };
    expect(result.Country).toHaveLength(2);
    expect(result.Country[0].Name).toBe('BULGARIA');
  });
});

describe('extractDiffgramRows (M4 spec §5a — najmanje 3 poznata alternativna oblika)', () => {
  it('pronalazi redove direktno na najvišem nivou', () => {
    const rows = extractDiffgramRows({ HotelService: [{ HotelKey: 1 }, { HotelKey: 2 }] }, ['HotelService']);
    expect(rows).toHaveLength(2);
  });

  it('pronalazi redove unutar diffgram.DocumentElement', () => {
    const rows = extractDiffgramRows({ diffgram: { DocumentElement: { HotelService: [{ HotelKey: 1 }] } } }, ['HotelService']);
    expect(rows).toHaveLength(1);
  });

  it('pronalazi redove unutar NewDataSet', () => {
    const rows = extractDiffgramRows({ NewDataSet: { HotelService: { HotelKey: 1 } } }, ['HotelService']);
    expect(rows).toEqual([{ HotelKey: 1 }]); // jedan red se ne parsira kao niz od strane XML parsera
  });

  it('vraća prazan niz kad nijedna putanja ne odgovara (ne baca grešku)', () => {
    expect(extractDiffgramRows({ nesto: 'drugo' }, ['HotelService'])).toEqual([]);
  });
});

describe('extractStarRating (M4 spec §5a — nikad pretpostaviti 0)', () => {
  it('prepoznaje "4*" obrazac', () => {
    expect(extractStarRating('Hotel Palace 4*')).toBe(4);
  });

  it('prepoznaje "4 stars" obrazac', () => {
    expect(extractStarRating('Hotel Palace 4 stars')).toBe(4);
  });

  it('vraća null kad tekst ne sadrži prepoznatljiv obrazac (ne pretpostavlja 0)', () => {
    expect(extractStarRating('Hotel bez broja zvezdica')).toBeNull();
  });

  it('vraća null za prazan/nedefinisan tekst', () => {
    expect(extractStarRating(null)).toBeNull();
    expect(extractStarRating(undefined)).toBeNull();
  });
});

describe('firstDefined (M4 spec §5a — obe varijante naziva polja viđene u praksi)', () => {
  it('vraća vrednost prvog definisanog ključa', () => {
    expect(firstDefined({ QuoteType: 1 }, 'QuotaType', 'QuoteType')).toBe(1);
  });

  it('vraća undefined kad nijedan ključ ne postoji', () => {
    expect(firstDefined({}, 'QuotaType', 'QuoteType')).toBeUndefined();
  });
});
