import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';

// Nalaz 2.4b (dok. 39) — prijava je najkritičniji put u panelu: ako ovo ne radi, niko ne može
// da uđe u aplikaciju. `next/navigation` (useRouter) nema DOM okruženje van pravog Next-a, pa
// se mokuje — isti obrazac koji Next-ova sopstvena dokumentacija za testiranje App Router-a
// preporučuje.
const push = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as jest.Mock;
}

describe('LoginForm', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
  });

  it('prijavljuje korisnika bez 2FA i vodi na početnu', async () => {
    mockFetchOnce(200, { ok: true });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email/i), 'agent@terminal-travel.local');
    await userEvent.type(screen.getByLabelText(/lozinka/i), 'lozinka123');
    await userEvent.click(screen.getByRole('button', { name: /prijavi_se/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(refresh).toHaveBeenCalled();
  });

  it('prelazi na korak MFA kad server to traži, bez odlaska sa ekrana', async () => {
    mockFetchOnce(200, { requiresMfa: true, mfaToken: 'tok-123' });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email/i), 'agent@terminal-travel.local');
    await userEvent.type(screen.getByLabelText(/lozinka/i), 'lozinka123');
    await userEvent.click(screen.getByRole('button', { name: /prijavi_se/i }));

    expect(await screen.findByText(/2fa --verify/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('prikazuje grešku sa servera i ostaje na ekranu prijave (pogrešna lozinka)', async () => {
    mockFetchOnce(401, { message: 'Pogrešan email ili lozinka' });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email/i), 'agent@terminal-travel.local');
    await userEvent.type(screen.getByLabelText(/lozinka/i), 'pogresna');
    await userEvent.click(screen.getByRole('button', { name: /prijavi_se/i }));

    expect(await screen.findByText('Pogrešan email ili lozinka')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
