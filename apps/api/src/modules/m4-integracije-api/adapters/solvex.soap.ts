import { XMLBuilder, XMLParser } from 'fast-xml-parser';

// M3-stil napomena (M4 spec §5a): Solvex namespace je http://www.megatec.ru/, potvrđeno
// izolovanim spike testom (avgust 2026) — envelope/SOAPAction oblik ispod je stvarno
// odgovorio ispravno formiranim XML-om (Connect/GetCountries), nezavisno od toga da li su
// akreditivi trenutno važeći.
const NAMESPACE = 'http://www.megatec.ru/';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressEmptyNode: true,
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: true,
});

/** M4 spec §5a — parametri se prosleđuju u istom redosledu u kom su navedeni u objektu (WSDL sequence). */
export function buildSoapEnvelope(method: string, params: Record<string, unknown>): string {
  const envelope = {
    '?xml': { '@_version': '1.0', '@_encoding': 'utf-8' },
    'soap:Envelope': {
      '@_xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
      'soap:Body': {
        [method]: { '@_xmlns': NAMESPACE, ...params },
      },
    },
  };
  return builder.build(envelope);
}

export function soapActionHeader(method: string): string {
  return `"${NAMESPACE}${method}"`;
}

/**
 * M4 spec §5a — "Odgovor pretrage je ADO.NET diffgram/DataSet XML ... najmanje 3 poznata
 * alternativna oblika" — parser mora fleksibilno da proba sve poznate putanje umesto da
 * pretpostavi jedan fiksni oblik. Ova funkcija vraća `<Method>Result` sadržaj bez obzira
 * da li je odgovor "flat" ili umotan u diffgram/DataSet, ili baca ako je SOAP Fault.
 */
export function parseSoapResponse(xml: string, method: string): unknown {
  const parsed = parser.parse(xml);
  const envelope = parsed.Envelope;
  if (!envelope) throw new Error('Solvex SOAP odgovor bez Envelope elementa');

  const body = envelope.Body;
  if (!body) throw new Error('Solvex SOAP odgovor bez Body elementa');

  if (body.Fault) {
    const fault = body.Fault;
    throw new Error(`Solvex SOAP Fault: ${fault.faultstring ?? fault.Reason?.Text ?? 'nepoznata greška'}`);
  }

  const response = body[`${method}Response`];
  if (!response) return body;

  return response[`${method}Result`] ?? response;
}

/** Izvlači redove iz diffgram/DataSet odgovora, probajući poznate putanje (§5a). */
export function extractDiffgramRows(result: unknown, rowTagCandidates: string[]): Record<string, unknown>[] {
  const candidatePaths: unknown[] = [
    result,
    (result as any)?.diffgram?.DocumentElement,
    (result as any)?.diffgram?.NewDataSet,
    (result as any)?.NewDataSet,
    (result as any)?.DocumentElement,
  ];

  for (const candidate of candidatePaths) {
    if (!candidate || typeof candidate !== 'object') continue;
    for (const tag of rowTagCandidates) {
      const rows = (candidate as Record<string, unknown>)[tag];
      if (rows === undefined) continue;
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [rows as Record<string, unknown>];
    }
  }
  return [];
}

/** M4 spec §5a — heuristička ekstrakcija broja zvezdica iz teksta; null kad nije pouzdano (nikad pretpostaviti 0). */
export function extractStarRating(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d)\s*(\*|stars?)/i);
  if (!match) return null;
  const stars = parseInt(match[1], 10);
  return stars >= 1 && stars <= 5 ? stars : null;
}

/** Prvo polje čija vrednost nije undefined — Solvex koristi obe varijante naziva u različitim odgovorima (§5a). */
export function firstDefined<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key] as T;
  }
  return undefined;
}
