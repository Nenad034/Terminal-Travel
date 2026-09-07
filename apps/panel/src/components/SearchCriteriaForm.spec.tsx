import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchCriteriaForm, { valuesFromSearchParams, type SearchCriteriaValues } from './SearchCriteriaForm';

// Nalaz 2.4b (dok. 39) — pretraga je jedan od putanja koje se ne smeju pokvariti: dugme
// "pretraži" mora ostati onemogućeno dok država nije uneta (M5 spec §3.0c.2, jedino obavezno
// polje), i mora da sastavi ispravnu adresu kad se pošalje.
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

// SuggestField gađa `/api/search-suggest` dok korisnik kuca — u testu se to ne razrešava, samo
// se osigurava da ne baci grešku (component već pokriva `!res.ok` slučaj).
global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock;

function emptyValues(): SearchCriteriaValues {
  return valuesFromSearchParams({ get: () => null });
}

describe('SearchCriteriaForm', () => {
  beforeEach(() => push.mockClear());

  it('dugme "pretraži" je onemogućeno dok država odredišta nije uneta', () => {
    render(<SearchCriteriaForm label="Smeštaj" types={['ACCOMMODATION']} initialValues={emptyValues()} />);

    expect(screen.getByRole('button', { name: /pretraži/i })).toBeDisabled();
  });

  it('unosom države se dugme omogućava i slanje vodi na /rezervacije/pretraga sa tipom i državom', async () => {
    render(<SearchCriteriaForm label="Smeštaj" types={['ACCOMMODATION']} initialValues={emptyValues()} />);

    await userEvent.type(screen.getByPlaceholderText('Grčka'), 'Grčka');
    const button = screen.getByRole('button', { name: /pretraži/i });
    expect(button).toBeEnabled();

    await userEvent.click(button);

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/rezervacije\/pretraga\?/);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('type')).toBe('ACCOMMODATION');
    expect(params.get('destinationCountry')).toBe('Grčka');
  });

  it('poruka o obaveznoj državi se ne prikazuje dok korisnik ništa nije dirao', () => {
    render(<SearchCriteriaForm label="Smeštaj" types={['ACCOMMODATION']} initialValues={emptyValues()} />);

    expect(screen.queryByText(/unesite bar državu odredišta/i)).not.toBeInTheDocument();
  });
});
