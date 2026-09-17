import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { apiFetch } from '@/lib/api-client';
import LoginForm from './LoginForm';
import LoginStage, { type LoginSlide } from './LoginStage';
import { version } from '../../../package.json';
import './prijava.css';

// Dizajn dok. 29 §6i / M17 §3.0 (17.9.2026, vlasnikova odluka) — „naslovna strana radnog
// dana". Pozadina i blok „Iz kataloga" dolaze iz JAVNOG kataloga (isti podaci koje vidi gost,
// M2 §5.1) — ekran je pre autentikacije, pa ne sme da čita ništa drugo. Greška API-ja ne sme
// da obori prijavu: tada nema slika = generativna pozadina, bez bloka.

interface PublicProduct {
  id: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  geoLat: number | string | null;
  geoLng: number | string | null;
  media: { url: string; category: string; order?: number }[] | null;
  translation: { name: string; shortDescription?: string | null } | null;
}

const MEDIA_PRIORITY = ['EXTERIOR', 'ROOM'];

function pickImage(media: PublicProduct['media']): string | null {
  if (!media || media.length === 0) return null;
  const sorted = [...media].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const cat of MEDIA_PRIORITY) {
    const hit = sorted.find((m) => m.category === cat && m.url);
    if (hit) return hit.url;
  }
  return sorted.find((m) => m.url)?.url ?? null;
}

function formatGeo(lat: PublicProduct['geoLat'], lng: PublicProduct['geoLng']): string | null {
  // `Decimal` stiže kao string (zamka 10.1) — Number() pre formatiranja.
  if (lat === null || lng === null) return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const ns = la >= 0 ? 'N' : 'S';
  const ew = lo >= 0 ? 'E' : 'W';
  return `${Math.abs(la).toFixed(4)}° ${ns} · ${Math.abs(lo).toFixed(4)}° ${ew}`;
}

async function loadSlides(): Promise<LoginSlide[]> {
  let products: PublicProduct[] = [];
  try {
    products = await apiFetch<PublicProduct[]>(
      '/catalog/public/products?channel=B2C_SITE&lang=sr',
      { auth: false },
    );
  } catch {
    return [];
  }
  const withImage = products
    .map((p) => ({ p, url: pickImage(p.media) }))
    .filter((x): x is { p: PublicProduct; url: string } => Boolean(x.url && x.p.destinationCity));
  // Nasumičan redosled, do tri, različite destinacije (§6i).
  for (let i = withImage.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [withImage[i], withImage[j]] = [withImage[j], withImage[i]];
  }
  const seen = new Set<string>();
  const slides: LoginSlide[] = [];
  for (const { p, url } of withImage) {
    const key = `${p.destinationCountry}|${p.destinationCity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slides.push({
      imageUrl: url,
      place: p.destinationCity!,
      country: p.destinationCountry,
      productName: p.translation?.name ?? '',
      geo: formatGeo(p.geoLat, p.geoLng),
      note: p.translation?.shortDescription ?? null,
    });
    if (slides.length === 3) break;
  }
  return slides;
}

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect('/');

  const slides = await loadSlides();

  return (
    <LoginStage slides={slides} version={version}>
      <LoginForm />
    </LoginStage>
  );
}
