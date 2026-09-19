import {
  applyScenarioToRow,
  isScenarioActive,
  scenarioLabel,
  scenarioTotals,
  solveMarginForTargetNeto,
} from './scenario';
import type { TableColumn, TableRow } from './table-spec';

// M17 spec §6e.4 — formule scenarija su u kodu i testirane; model ih nikad ne računa.
const columns: TableColumn[] = [
  { key: 'broj', label: 'Broj', type: 'text' },
  { key: 'prodajna', label: 'Prodajna', type: 'money', derived: 'prodajna' },
  { key: 'nabavna', label: 'Nabavna', type: 'money', derived: 'nabavna' },
  { key: 'marza', label: 'Marža', type: 'money', derived: 'marza' },
  { key: 'marza_pct', label: 'Marža %', type: 'percent', derived: 'marza_pct' },
  { key: 'provizija', label: 'Provizija', type: 'money', derived: 'provizija' },
  { key: 'neto', label: 'Neto', type: 'money', derived: 'neto' },
];
const row: TableRow = {
  _key: 'a',
  broj: 'TT-1',
  prodajna: 1200,
  nabavna: 1000,
  marza: 200,
  marza_pct: 20,
  provizija: 0,
  neto: 200,
};

describe('scenario (§6e.4)', () => {
  it('prazan scenario nije aktivan i ne menja red', () => {
    expect(isScenarioActive({})).toBe(false);
    expect(isScenarioActive({ marzaPct: null })).toBe(false);
    expect(applyScenarioToRow(row, columns, {})).toBe(row);
  });

  it('marža 18% → prodajna iz nabavne, marža/neto preračunati, izvorni red netaknut', () => {
    const out = applyScenarioToRow(row, columns, { marzaPct: 18 });
    expect(out).toMatchObject({
      prodajna: 1180,
      nabavna: 1000,
      marza: 180,
      marza_pct: 18,
      neto: 180,
    });
    expect(row.prodajna).toBe(1200);
  });

  it('nabavna +5% bez marže → prodajna se pomera za isti %, marža % ostaje', () => {
    const out = applyScenarioToRow(row, columns, { nabavnaDeltaPct: 5 });
    expect(out).toMatchObject({ nabavna: 1050, prodajna: 1260, marza: 210, marza_pct: 20 });
  });

  it('provizija 10% ide od (scenario) prodajne i smanjuje neto; kurs daje kolonu u RSD', () => {
    const out = applyScenarioToRow(row, columns, { provizijaPct: 10, kurs: 117 });
    expect(out).toMatchObject({ provizija: 120, neto: 80, prodajna_rsd: 140400 });
  });

  it('bez nabavne u podatku (maskiran pozivalac) marža/neto ostaju null — ne izmišlja se', () => {
    const cols = columns.filter((c) => c.key === 'prodajna' || c.key === 'broj');
    const out = applyScenarioToRow({ _key: 'b', broj: 'TT-2', prodajna: 500 }, cols, {
      marzaPct: 30,
    });
    expect(out.prodajna).toBe(500);
    expect(out.marza).toBeUndefined();
  });

  it('popunjenost deluje SAMO na zbirove', () => {
    const t = scenarioTotals([row, { ...row, _key: 'c' }], columns, { popunjenostDeltaPct: 10 });
    expect(t.prodajna).toBe(2640);
    expect(t.neto).toBe(440);
    expect(applyScenarioToRow(row, columns, { popunjenostDeltaPct: 10 }).prodajna).toBe(1200);
  });

  it('kod traži maržu za ciljni neto (bisekcija), model samo formuliše', () => {
    const m = solveMarginForTargetNeto([row], columns, 300, {});
    expect(m).toBe(30);
    expect(solveMarginForTargetNeto([row], columns, 5000, {})).toBeNull();
  });

  it('natpis scenarija nabraja samo zadate parametre', () => {
    expect(scenarioLabel({ marzaPct: 18, kurs: null })).toBe('marža % = 18');
  });
});
