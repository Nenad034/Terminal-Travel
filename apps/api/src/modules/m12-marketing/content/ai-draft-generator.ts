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
  const shortDescription = productDescription.length > 280 ? `${productDescription.slice(0, 277)}...` : productDescription;
  const body =
    `${productName} (${destinationCity}, ${destinationCountry}) je od sada deo naše ponude.\n\n` +
    `${shortDescription}\n\n` +
    `Rezervišite na vreme — kontaktirajte naš tim za detalje i dostupnost.`;
  return { title, body };
}
