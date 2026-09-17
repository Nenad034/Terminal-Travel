// M12 spec §3, korak 2 — "AI agent automatski priprema nacrt ... nivo 'Autonomno'". Ovo NIJE
// prava LLM integracija (zadatak eksplicitno traži "razuman placeholder tekst iz naziva/opisa
// proizvoda") — čisto deterministička funkcija, testibilna bez mreže/troška, koja generiše
// dovoljno razuman nacrt da čovek u koraku odobrenja (§3, korak 4) ima od čega da krene.
// Kad TT kasnije poveže pravi LLM (M15/M23 obrazac), ovo mesto se menja da poziva njega —
// interfejs (ulaz: naziv/opis/destinacija, izlaz: title/body) ostaje isti.

export interface DraftSourceFields {
  productName: string;
  productDescription: string;
  destinationCity: string;
  destinationCountry: string;
}

export interface GeneratedDraft {
  title: string;
  body: string;
}

export function generateAiDraft(fields: DraftSourceFields): GeneratedDraft {
  const { productName, productDescription, destinationCity, destinationCountry } = fields;
  const title = `Novo u ponudi: ${productName}`;
  const shortDescription =
    productDescription.length > 280 ? `${productDescription.slice(0, 277)}...` : productDescription;
  const body =
    `${productName} (${destinationCity}, ${destinationCountry}) je od sada deo naše ponude.\n\n` +
    `${shortDescription}\n\n` +
    `Rezervišite na vreme — kontaktirajte naš tim za detalje i dostupnost.`;
  return { title, body };
}

// ---------------------------------------------------------------------------
// M12 spec §3d (v1.8, 17.9.2026) — nacrt iz M3 događaja `pricelist.offer.expiring`.
//
// Namerno BEZ poziva jezičkom modelu: sve činjenice (objekat, destinacija, vrsta akcije, popust,
// boravak, rok) stižu u događaju, pa je tekst čist šablon — kod radi posao, model bi trošio
// budžet (M18) da kaže isto. Kad vlasnik poželi „življi" tekst, ovo mesto poziva model sa istim
// ulazom; potpis ostaje isti. Pravilo iz M3 §4.9.3 i M12 §3d: rok se piše KAO DATUM
// („rezervacije do 30.9.2026"), nikad „još 7 dana" — objava se odobrava možda dva dana kasnije.
// ---------------------------------------------------------------------------

export interface OfferExpiryDraftSource {
  productName: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  offerKind: 'EARLY_BOOKING' | 'FREE_NIGHTS' | 'DISCOUNT' | 'FIRST_TRANCHE';
  discountSummary: string;
  /** ISO dan (`YYYY-MM-DD`). */
  bookingTo: string;
  stayFrom: string | null;
  stayTo: string | null;
}

const OFFER_KIND_LABEL: Record<OfferExpiryDraftSource['offerKind'], string> = {
  EARLY_BOOKING: 'rani buking',
  FREE_NIGHTS: 'gratis noći',
  DISCOUNT: 'popust',
  FIRST_TRANCHE: 'cena prve tranše',
};

/** `2026-09-30` → `30.9.2026.` (srpski zapis datuma, bez zavisnosti od lokala procesa). */
export function formatSrDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}.${m}.${y}.`;
}

export function generateOfferExpiryDraft(src: OfferExpiryDraftSource): GeneratedDraft {
  const objekat = src.productName ?? 'Smeštaj iz naše ponude';
  const mesto = [src.destinationCity, src.destinationCountry].filter(Boolean).join(', ');
  const naslov = `${OFFER_KIND_LABEL[src.offerKind]} ${src.discountSummary} — ${objekat}${mesto ? `, ${mesto}` : ''}`;
  const title = naslov.charAt(0).toUpperCase() + naslov.slice(1);
  const boravak =
    src.stayFrom && src.stayTo
      ? ` za boravak od ${formatSrDate(src.stayFrom)} do ${formatSrDate(src.stayTo)}`
      : '';
  // Srpski zapis datuma već završava tačkom („24.9.2026.") — rečenica koja se njime završava
  // ne dobija drugu tačku.
  const body =
    `${objekat}${mesto ? ` (${mesto})` : ''}: ${OFFER_KIND_LABEL[src.offerKind]} ${src.discountSummary}${boravak}${boravak ? '' : '.'}\n\n` +
    `Rezervacije po ovim uslovima primamo do ${formatSrDate(src.bookingTo)} ` +
    `Posle tog datuma važe redovne cene.\n\n` +
    `Javite nam se za ponudu i raspoložive termine.`;
  return { title, body };
}
