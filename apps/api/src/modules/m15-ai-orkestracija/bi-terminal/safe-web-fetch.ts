import { lookup } from 'dns/promises';
import { isIPv4, isIPv6 } from 'net';

// M15 spec §6.5.6b — zaštita od SSRF-a pre svakog izlaznog poziva ka proizvoljnom URL-u koji
// predloži agent. Jedini zajednički prolaz kroz koji BiTerminalAgent (§6.9.7) sme da pozove
// spoljni sajt — jezički model nikad ne dobija sirov `fetch`, samo ovaj kontrolisan omotač.
export interface SafeFetchResult {
  ok: boolean;
  status?: number;
  text?: string;
  finalUrl?: string;
  error?: string;
}

const MAX_REDIRECTS = 5;
const MAX_TEXT_LENGTH = 50_000; // ~50KB teksta — isti "tanak oblik" princip kao M4 §2.4 (trošak/token)
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (fc00::/7)
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.replace('::ffff:', ''));
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === 'localhost') throw new Error('Pristup localhost-u nije dozvoljen.');
  let addresses: { address: string; family: number }[];
  try {
    const result = await lookup(hostname, { all: true });
    addresses = Array.isArray(result) ? result : [result];
  } catch {
    throw new Error(`Ne mogu da razrešim domen "${hostname}".`);
  }
  for (const { address } of addresses) {
    if (isIPv4(address) && isPrivateIPv4(address)) throw new Error(`Domen "${hostname}" vodi ka privatnoj/internoj adresi — blokirano.`);
    if (isIPv6(address) && isPrivateIPv6(address)) throw new Error(`Domen "${hostname}" vodi ka privatnoj/internoj adresi — blokirano.`);
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Preuzima SAMO tekst (§6.5.6b "Samo tekst, nikad izvršavanje") sa jednog konkretnog URL-a, uz
// SSRF proveru pre svakog skoka (uključujući redirect-e — ne prati ih slepo, isto pravilo za svaki
// hop). Poznato preostalo ograničenje: DNS provera i sam poziv nisu atomski (TOCTOU) — prihvatljivo
// jer je ovaj put dostupan isključivo VLASNIK-u, po pojedinačnom eksplicitnom odobrenju (§6.9.7),
// ne javna/neautentikovana putanja.
export async function safeFetchText(rawUrl: string): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Neispravan URL.' };
  }

  let redirects = 0;
  while (true) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: `Protokol "${url.protocol}" nije dozvoljen — samo http/https.` };
    }
    try {
      await assertPublicHost(url.hostname);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'TerminalTravel-BiTerminalAgent/1.0 (kontrolisano preuzimanje, uz odobrenje Vlasnika)' },
      });
    } catch (err) {
      return { ok: false, error: `Preuzimanje nije uspelo: ${(err as Error).message}` };
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) return { ok: false, error: 'Previše preusmerenja.' };
      url = new URL(response.headers.get('location')!, url);
      continue;
    }

    if (!response.ok) {
      return { ok: false, status: response.status, error: `Server je vratio status ${response.status}.` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json')) {
      return { ok: false, error: `Sadržaj tipa "${contentType}" nije podržan — samo tekst/HTML.` };
    }

    const raw = await response.text();
    const text = (contentType.includes('html') ? stripHtmlToText(raw) : raw).slice(0, MAX_TEXT_LENGTH);
    return { ok: true, status: response.status, text, finalUrl: url.toString() };
  }
}
