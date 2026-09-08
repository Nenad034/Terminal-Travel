// Grafički prikaz "Vremenskih obrazaca" (M13 §4.4, 8.9.2026 — vlasnikov zahtev "omogucite
// graficki prikaz i vremenskih obrazaca").
//
// ZAŠTO TEST, a ne samo snimak ekrana: dva od tri oblika prikaza su provereni u browseru na
// stvarnim podacima (toplotna mapa "rezervacije po satu", bar-grafik "po destinaciji"), ali
// treći — "koliko unapred se otkazuje" — u lokalnoj bazi nema nijednu otkazanu rezervaciju, pa
// se u browseru vidi samo prazno stanje. Njegova jedina razlika u odnosu na već viđeni
// bar-grafik je `sort={false}` (vremenska skala 48h+ → 24–48h → <24h ne sme da se presortira po
// veličini), i upravo to ovde stoji kao dokaz umesto tvrdnje. Zamka 7.1: build i tipovi nisu
// dokaz da ekran radi.

import { render, screen } from '@testing-library/react';
import BarChart, { type ChartSeries } from './BarChart';
import HourHeatmap from './HourHeatmap';

interface CountRow {
  key: string;
  count: number;
}
const COUNT_SERIES: ChartSeries<CountRow>[] = [
  { label: 'broj', color: 'var(--accent)', value: (r) => r.count },
];

describe('BarChart — redosled kategorija', () => {
  // Lead-time iz §4.4 stiže u vremenskom redosledu, a najveća vrednost je namerno u sredini —
  // sortiranje po veličini bi je izbacilo na vrh i skala vremena bi se raspala.
  const LEAD_TIME: CountRow[] = [
    { key: '48h+', count: 3 },
    { key: '24-48h', count: 9 },
    { key: '<24h', count: 5 },
  ];

  it('sa sort={false} zadržava redosled kojim su redovi stigli', () => {
    render(<BarChart rows={LEAD_TIME} series={COUNT_SERIES} sort={false} />);
    const labels = screen.getAllByTitle(/^(48h\+|24-48h|<24h)$/).map((el) => el.textContent);
    expect(labels).toEqual(['48h+', '24-48h', '<24h']);
  });

  it('podrazumevano (sort neizostavljen) i dalje sortira po veličini — ostali izveštaji', () => {
    render(<BarChart rows={LEAD_TIME} series={COUNT_SERIES} />);
    const labels = screen.getAllByTitle(/^(48h\+|24-48h|<24h)$/).map((el) => el.textContent);
    expect(labels).toEqual(['24-48h', '<24h', '48h+']);
  });
});

describe('HourHeatmap — toplotna mapa sat × dan', () => {
  it('prazan period daje poruku, ne mrežu nula', () => {
    render(<HourHeatmap cells={[]} />);
    expect(screen.getByText('Nema podataka za zadati period.')).toBeInTheDocument();
  });

  it('zbir nula (postoje redovi, sve nule) se takođe čita kao prazan period', () => {
    render(<HourHeatmap cells={[{ hour: 9, dayOfWeek: 1, count: 0 }]} />);
    expect(screen.getByText('Nema podataka za zadati period.')).toBeInTheDocument();
  });

  it('ističe vršni termin i zbraja po danu', () => {
    render(
      <HourHeatmap
        cells={[
          { hour: 9, dayOfWeek: 1, count: 4 },
          { hour: 10, dayOfWeek: 1, count: 2 },
          { hour: 21, dayOfWeek: 6, count: 7 },
        ]}
      />,
    );
    // Vršni termin — jedini broj upisan u samu mrežu (ostali su na hover/u tabeli).
    // Traži se kroz sam sažetak iznad mreže, jer isti tekst postoji i u `sr-only` opisu polja.
    const sazetak = screen.getByText(/Najviše:/).textContent ?? '';
    expect(sazetak).toContain('Subota 21–22h');
    expect(sazetak).toContain('7 (53,8% od ukupno 13)');
    // Polje nosi tačnu vrednost na hover (nativni `title`), i za polje koje nije vršno.
    expect(screen.getByTitle('Ponedeljak 09–10h — 4')).toBeInTheDocument();
  });

  it('vrednosti za isti sat/dan se sabiraju umesto da se pregaze', () => {
    render(
      <HourHeatmap
        cells={[
          { hour: 8, dayOfWeek: 3, count: 2 },
          { hour: 8, dayOfWeek: 3, count: 3 },
        ]}
      />,
    );
    expect(screen.getByTitle('Sreda 08–09h — 5')).toBeInTheDocument();
  });
});
