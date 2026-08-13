// M12 spec §3c (YUTA preporuka, avgust 2026) — kad contains_ai_generated_media=true, odobrenje
// zahteva da BODY jezika objave sadrži "vidljivu oznaku transparentnosti" (npr. "Fotografija je
// generisana uz pomoć veštačke inteligencije (AI)."). Spec eksplicitno ostavlja tačnu proveru na
// implementaciju ("na tebi je, dokumentuj izbor u kodu") — izbor ovde: regex na varijante reči
// "AI"/"veštačk(a/e/i/o)" (pokriva "veštačka inteligencija" u svim padežima) u telu teksta, bez
// razlikovanja velikih/malih slova. Namerno permisivno (jedna od dve reči je dovoljna) — cilj je
// da spreči POTPUNO odsustvo oznake, ne da propisuje tačnu formulaciju (spec: "izbor formulacije
// ostaje uređivački, ne mehanički").
const TRANSPARENCY_MARKER_PATTERN = /\bAI\b|veštačk/i;

export function hasAiTransparencyMarker(body: string): boolean {
  return TRANSPARENCY_MARKER_PATTERN.test(body);
}
