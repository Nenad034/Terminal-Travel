// M5 spec §2.1 — formula marže, fiksan redosled, deterministička.
// finalna_cena = round(nabavna_cena * (1 + percentage / 100)) + fixed_amount
// percentage/fixed_amount se tretiraju kao 0 kad nisu postavljeni. Sve novčane
// vrednosti (baseCost, fixedAmount, rezultat) su Int u najmanjoj jedinici valute
// (M5 spec §2, ista konvencija kao M3/M10) — round() ovde zaokružuje na najbližu
// celu jedinicu te valute, izbegava float aritmetiku kroz ceo lanac izračuna.

export interface MarkupRuleLike {
  // Prisma.Decimal implementuje toString()/valueOf() — Number() nad njim radi ispravno;
  // tip ovde ostaje široko prihvatljiv (number/string/Decimal-like) da se izbegne
  // uvoženje Prisma tipa u čisto-logički modul koji se testira bez Prisma runtime-a.
  percentage: number | string | { toString(): string } | null | undefined;
  fixedAmount: number | null | undefined;
}

export function applyMarkup(baseCost: number, rule: MarkupRuleLike): number {
  const percentage = rule.percentage != null ? Number(rule.percentage) : 0;
  const fixedAmount = rule.fixedAmount ?? 0;
  return Math.round(baseCost * (1 + percentage / 100)) + fixedAmount;
}

// M5 spec §2.1 — "Bar jedno od dva mora biti postavljeno da bi pravilo bilo validno."
export function isValidMarkupRule(rule: MarkupRuleLike): boolean {
  return rule.percentage != null || rule.fixedAmount != null;
}
