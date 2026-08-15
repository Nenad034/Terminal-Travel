// M18 spec §6.3 — estimated_cost_eur. Aproksimativna cenovna tabela, ne stvarna faktura —
// koristi se isključivo za interno praćenje budžeta/trendova (§6.4/§6.5), ne za knjigovodstvo.
// Ažurirati kad se dobije zvaničan, aktuelan cenovnik provajdera (spec §11 ostavlja tačan
// budžet u EUR kao vlasnikovu odluku — ova tabela je samo ulaz u tu računicu, ne sama odluka).
// Cene po milionu tokena, u EUR (grubo pretvoreno iz USD cenovnika, ~0.92 EUR/USD).
const PRICE_PER_MILLION_TOKENS_EUR: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.92, output: 4.6 },
};

const DEFAULT_PRICE = { input: 1, output: 5 }; // konzervativna pretpostavka za nepoznat model_identifier

export function estimateCostEur(modelIdentifier: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_PER_MILLION_TOKENS_EUR[modelIdentifier] ?? DEFAULT_PRICE;
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // zaokruženo na 6 decimala
}

/** M18 spec §6.4 — provajder se izvodi iz model_identifier prefiksa (jedino što danas postoji je Anthropic). */
export function providerFromModelIdentifier(modelIdentifier: string): string {
  if (modelIdentifier.startsWith('claude-')) return 'ANTHROPIC';
  if (modelIdentifier.startsWith('gpt-')) return 'OPENAI';
  if (modelIdentifier.startsWith('gemini-')) return 'GOOGLE';
  return 'UNKNOWN';
}
