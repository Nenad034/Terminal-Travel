import { render, screen } from '@testing-library/react';
import Pagination from './Pagination';

// Nalaz 2.4b (dok. 39) — lista rezervacija (i svaka druga straničena lista) ne sme tiho da
// odseca (nalaz 2.2) niti da ispisuje pogrešan raspon. Ovaj test zaključava obe stvari, uz
// regresiju za grešku nađenu 5.9.2026: raspon je bio računat iz `shown` (broj redova stvarno
// prikazanih), što je na POSLEDNJOJ, nepunoj strani davalo pogrešnu donju granicu.
describe('Pagination', () => {
  it('prikazuje "nema zapisa" kad je total 0, bez strelica', () => {
    render(
      <Pagination
        page={1}
        pageCount={1}
        total={0}
        shown={0}
        limit={10}
        basePath="/rezervacije/lista"
        searchParams={{}}
      />,
    );

    expect(screen.getByText(/nema zapisa/i)).toBeInTheDocument();
    expect(screen.queryByTitle('sledeća strana')).not.toBeInTheDocument();
  });

  it('računa ispravan raspon na poslednjoj, nepunoj strani (25 zapisa, stranica od 10 → treća strana 21–25)', () => {
    render(
      <Pagination
        page={3}
        pageCount={3}
        total={25}
        shown={5}
        limit={10}
        basePath="/rezervacije/lista"
        searchParams={{}}
      />,
    );

    // Bag ispravljen 5.9.2026: raspon računat iz `shown` (5, koliko je STVARNO prikazano na
    // nepunoj strani) davao je "11–15" umesto tačnog "21–25" — mora se računati iz `limit`.
    expect(
      screen.getByText((_, node) => node?.textContent === 'prikazano 21–25 od 25 zapisa'),
    ).toBeInTheDocument();
  });

  it('strelica "prethodna" je onemogućena na prvoj strani, "sledeća" je aktivan link', () => {
    render(
      <Pagination
        page={1}
        pageCount={3}
        total={25}
        shown={10}
        limit={10}
        basePath="/rezervacije/lista"
        searchParams={{ status: 'CONFIRMED' }}
      />,
    );

    expect(screen.getByTitle('prethodna strana')).toHaveAttribute('aria-disabled');
    const next = screen.getByTitle('sledeća strana');
    expect(next.tagName).toBe('A');
    expect(next).toHaveAttribute('href', '/rezervacije/lista?status=CONFIRMED&page=2');
  });

  it('čuva ostale query parametre i ne dodaje page=1 za prvu stranu (link ostaje čist)', () => {
    render(
      <Pagination
        page={2}
        pageCount={3}
        total={25}
        shown={10}
        limit={10}
        basePath="/rezervacije/lista"
        searchParams={{ status: 'CONFIRMED' }}
      />,
    );

    const prev = screen.getByTitle('prethodna strana');
    expect(prev.tagName).toBe('A');
    expect(prev).toHaveAttribute('href', '/rezervacije/lista?status=CONFIRMED');
  });
});
