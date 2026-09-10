import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname } from 'path';
import { PricelistSourceFormat } from '@prisma/client';

/**
 * M3 spec §4.2.7 (v1.36, 10.9.2026) — skladiste uvezenih cenovnika.
 *
 * VLASNIKOVA ODLUKA: lokalni disk, za sada. Posledice su zapisane u specifikaciji i nisu
 * precutane — fajlovi ne prelaze izmedju masina (nisu u gitu) i nemaju rezervnu kopiju.
 * Cene se ne gube ni u jednom od ta dva slucaja, jer su u bazi.
 *
 * Prelazak na server sme da promeni SAMO vrednost `PRICELIST_STORAGE_DIR` u `.env`. Zato
 * nijedna druga datoteka ne sme da racuna gde je taj folder — sve ide kroz `storageDir()`.
 */
export const PRICELIST_STORAGE_ENV = 'PRICELIST_STORAGE_DIR';
// RELATIVNO na radni folder API procesa (`apps/api/`), ne na koren repozitorijuma — izmereno
// 10.9.2026 pri prvom stvarnom uvozu. `.gitignore` obrazac `storage/` hvata bilo koju dubinu,
// pa je pokriveno; za drugu lokaciju upisati APSOLUTNU putanju u `PRICELIST_STORAGE_DIR`.
const PODRAZUMEVANI_FOLDER = 'storage/pricelists';

export function storageDir(configured?: string | null): string {
  return configured?.trim() || PODRAZUMEVANI_FOLDER;
}

/**
 * §4.2.7 — granica je 25 MB, ispod API granice od 32 MB za ceo zahtev. Razlika je namerna:
 * fajl se u zahtevu ka modelu kodira u base64, sto ga uveca za oko trecinu, pa bi fajl tacno
 * na 32 MB pao TEK pri pozivu — posle upisa na disk, posle cekanja, sa porukom koju covek
 * ne moze da razume.
 */
export const MAX_VELICINA_FAJLA = 25 * 1024 * 1024;

/**
 * §4.2.7 — sta se prima. Kljuc je ekstenzija, vrednost je format koji ide u `source_format`.
 * `.doc`/`.xls` (stari binarni formati) NAMERNO nisu ovde: `ExtractFileService` ih odbija sa
 * uputstvom da se fajl sacuva kao `.docx`/`.xlsx`, i ta poruka je korisnija od tihog neuspeha.
 */
const FORMAT_PO_EKSTENZIJI: Record<string, PricelistSourceFormat> = {
  '.pdf': PricelistSourceFormat.PDF,
  '.xlsx': PricelistSourceFormat.EXCEL,
  '.docx': PricelistSourceFormat.WORD,
  '.html': PricelistSourceFormat.HTML,
  '.htm': PricelistSourceFormat.HTML,
  '.csv': PricelistSourceFormat.CSV,
  '.txt': PricelistSourceFormat.CSV,
  '.md': PricelistSourceFormat.CSV,
  '.jpg': PricelistSourceFormat.IMAGE,
  '.jpeg': PricelistSourceFormat.IMAGE,
  '.png': PricelistSourceFormat.IMAGE,
  '.webp': PricelistSourceFormat.IMAGE,
};

export const PODRZANE_EKSTENZIJE = Object.keys(FORMAT_PO_EKSTENZIJI);

export function formatIzImena(originalName: string): PricelistSourceFormat | null {
  return FORMAT_PO_EKSTENZIJI[extname(originalName).toLowerCase()] ?? null;
}

/** Slika uvek ide modelu — parser za nju ne postoji. */
export function jeSlika(format: PricelistSourceFormat): boolean {
  return format === PricelistSourceFormat.IMAGE;
}

/**
 * §4.2.7 — `media_type` koji API trazi uz `image` blok. Izvedeno iz ekstenzije, ne iz
 * `mimetype` koji salje pregledac: pregledac za `.webp` ume da posalje `application/octet-stream`,
 * i tada poziv pada na necemu sto nema veze sa sadrzajem fajla.
 */
export function mediaTypeSlike(originalName: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = extname(originalName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * §4.2.7 — prag ispod kog se izvuceni tekst smatra neupotrebljivim i fajl ide modelu.
 *
 * Skeniran PDF kroz `pdf-parse` ne vraca gresku nego PRAZAN (ili gotovo prazan) tekst — samo
 * zaglavlja i brojeve strana. Prag je zato i provera i odluka u jednom potezu: ne postavlja se
 * pitanje "da li je ovo skenirano", na koje bi se ionako odgovaralo pogadjanjem.
 *
 * 200 znakova: kraci od toga ne moze biti cenovnik ni sa jednim jedinim redom (naziv hotela,
 * tip sobe, usluga, dva datuma i cena vec predju tu duzinu).
 */
export const MIN_KORISNOG_TEKSTA = 200;

export function tekstJeUpotrebljiv(tekst: string): boolean {
  return tekst.trim().length >= MIN_KORISNOG_TEKSTA;
}

/**
 * §4.2.7 — folder mora da postoji pre nego sto multer pokusa da upise. Pravi se pri prvom
 * uvozu, ne pri pokretanju aplikacije: instalacija koja nikad ne uvozi cenovnik nema razloga
 * da dobije prazan folder na disku.
 */
export function ensurePricelistUploadDir(configured?: string | null): string {
  const dir = storageDir(configured);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Ime na disku je nasumicno, jer dva dobavljaca lako posalju "cenovnik.pdf". Originalno ime se
 * cuva u bazi (`source_file_name`) i sluzi za prikaz — nikad za putanju.
 */
export function imeNaDisku(originalName: string): string {
  return `${randomUUID()}${extname(originalName).toLowerCase()}`;
}

/**
 * §4.2.8 — GORNJA granica izvučenog teksta, u znakovima.
 *
 * `MAX_VELICINA_FAJLA` meri fajl NA DISKU i tu ne pomaže: izmereno 10.9.2026, stvaran fajl
 * `Primeri cenovnika/014_Solvex_Offer_Summer_2025.xlsx` ima **1 MB na disku** a daje **2,1
 * miliona znakova** teksta — 946.445 tokena, oko **4,35 € samo za ulaz**, i skoro ceo kontekst
 * modela. Excel se pakuje, pa disk ne govori ništa o količini sadržaja.
 *
 * Taj fajl nije cenovnik jednog hotela nego ceo katalog dobavljača: 17 listova po destinaciji,
 * 966 hotela. Uvoz takvog dokumenta u jednom prolazu nema smisla ni po ceni ni po rezultatu —
 * odgovor bi ionako bio presečen (§4.2.8), jer 16.000 izlaznih tokena nosi oko 390 redova.
 *
 * 100.000 znakova je odabrano iz TOG računa, ne odokativno: najveći izmereni cenovnik jednog
 * hotela ima 19.721 znak, pa granica nosi petostruku zalihu, a Solvex katalog hvata dvadeset
 * puta.
 */
export const MAX_ZNAKOVA_TEKSTA = 100_000;

export function porukaZaPrevelikTekst(znakova: number): string {
  return (
    `Iz ovog dokumenta je izvučeno ${znakova.toLocaleString('sr-RS')} znakova teksta, a granica za ` +
    `jedan uvoz je ${MAX_ZNAKOVA_TEKSTA.toLocaleString('sr-RS')}. Ovo je najčešće ceo katalog ` +
    'dobavljača (više hotela ili više destinacija u jednom fajlu), ne cenovnik jednog objekta. ' +
    'Podeli ga — po listu, hotelu ili destinaciji — i uvezi delove redom.'
  );
}
