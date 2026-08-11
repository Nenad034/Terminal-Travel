import { applyMarkup, isValidMarkupRule } from './markup-formula';

describe('applyMarkup (M5 spec §2.1)', () => {
  it('primenjuje samo procenat', () => {
    expect(applyMarkup(10000, { percentage: 15, fixedAmount: null })).toBe(11500);
  });

  it('primenjuje samo fiksan iznos', () => {
    expect(applyMarkup(10000, { percentage: null, fixedAmount: 500 })).toBe(10500);
  });

  it('kombinuje procenat pa fiksan iznos, u tom redosledu', () => {
    // round(10000 * 1.15) + 500 = 11500 + 500 = 12000
    expect(applyMarkup(10000, { percentage: 15, fixedAmount: 500 })).toBe(12000);
  });

  it('zaokružuje na najbližu celu jedinicu valute', () => {
    // 10000 * 1.075 = 10750 tačno; probajmo necelu vrednost
    expect(applyMarkup(999, { percentage: 10, fixedAmount: null })).toBe(Math.round(999 * 1.1));
  });

  it('ista ulazna cena uvek daje istu izlaznu cenu (determinizam)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 5; i++) results.add(applyMarkup(12345, { percentage: 12.5, fixedAmount: 200 }));
    expect(results.size).toBe(1);
  });

  it('tretira nepostavljen procenat/fixedAmount kao 0', () => {
    expect(applyMarkup(10000, { percentage: null, fixedAmount: null })).toBe(10000);
  });
});

describe('isValidMarkupRule (M5 spec §2.1)', () => {
  it('odbija pravilo bez procenta i fiksnog iznosa', () => {
    expect(isValidMarkupRule({ percentage: null, fixedAmount: null })).toBe(false);
  });

  it('prihvata pravilo sa samo procentom', () => {
    expect(isValidMarkupRule({ percentage: 10, fixedAmount: null })).toBe(true);
  });

  it('prihvata pravilo sa samo fiksnim iznosom', () => {
    expect(isValidMarkupRule({ percentage: null, fixedAmount: 100 })).toBe(true);
  });
});
