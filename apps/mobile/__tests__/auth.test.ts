import { login, verifyMfa } from '../src/lib/auth';
import { apiFetch } from '../src/lib/api-client';
import { getSession } from '../src/lib/session';

jest.mock('../src/lib/api-client', () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

// M9 v1.4 — dvokoraka prijava (M1 spec §5/§6), isti tok kao apps/panel LoginForm.tsx.
// Testira se samo klijentska orkestracija (koji poziv ide kad, šta se upisuje u sesiju);
// sam MFA/JWT mehanizam je već pokriven M1 backend testovima.
describe('login', () => {
  it('kad server traži MFA, vraća requiresMfa bez upisa sesije', async () => {
    mockedApiFetch.mockResolvedValueOnce({ requiresMfa: true, mfaToken: 'mfa-token-1' });

    const result = await login('vodic@example.com', 'lozinka');

    expect(result).toEqual({ requiresMfa: true, mfaToken: 'mfa-token-1' });
    expect(await getSession()).toBeNull();
  });

  it('kad MFA nije potrebna, upisuje sesiju sa ulogom iz /iam/auth/me', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ accessToken: 'access-1', refreshToken: 'refresh-1' })
      .mockResolvedValueOnce({ userId: 'user-1', roles: ['GOST'] });

    const result = await login('gost@example.com', 'lozinka');

    expect(result).toEqual({ requiresMfa: false });
    const session = await getSession();
    expect(session).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1', userId: 'user-1', role: 'GOST' });
  });
});

describe('verifyMfa', () => {
  it('posle uspešne potvrde koda, upisuje sesiju sa ulogom VODIC', async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ accessToken: 'access-2', refreshToken: 'refresh-2' })
      .mockResolvedValueOnce({ userId: 'user-2', roles: ['VODIC'] });

    await verifyMfa('mfa-token-1', '123456');

    const session = await getSession();
    expect(session?.role).toBe('VODIC');
    expect(session?.userId).toBe('user-2');
  });
});
