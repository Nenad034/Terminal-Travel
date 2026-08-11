import { ApiKeyStrategy } from './api-key.strategy';
import { BasicAuthStrategy } from './basic.strategy';
import { OAuth2ClientCredentialsStrategy } from './oauth2-client-credentials.strategy';
import { RequestSigningStrategy } from './request-signing.strategy';
import { SessionTokenStrategy } from './session-token.strategy';

describe('ApiKeyStrategy', () => {
  it('dodaje API ključ u header i ne radi ništa pri refreshIfNeeded (M4 spec §2.2)', async () => {
    const strategy = new ApiKeyStrategy('tajni-kljuc');
    const result = strategy.applyAuth({ headers: {} });
    expect(result.headers['X-Api-Key']).toBe('tajni-kljuc');
    await expect(strategy.refreshIfNeeded()).resolves.toBeUndefined();
  });

  it('dozvoljava prilagođen naziv header-a', () => {
    const strategy = new ApiKeyStrategy('kljuc', 'TGX-Auth-API-Key');
    expect(strategy.applyAuth({ headers: {} }).headers['TGX-Auth-API-Key']).toBe('kljuc');
  });
});

describe('BasicAuthStrategy', () => {
  it('dodaje ispravno Base64-enkodiran Authorization header', () => {
    const strategy = new BasicAuthStrategy('user', 'pass');
    const result = strategy.applyAuth({ headers: {} });
    expect(result.headers.Authorization).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });
});

describe('OAuth2ClientCredentialsStrategy', () => {
  it('baca grešku ako se applyAuth pozove pre refreshIfNeeded', () => {
    const strategy = new OAuth2ClientCredentialsStrategy('https://x.com/token', 'id', 'secret');
    expect(() => strategy.applyAuth({ headers: {} })).toThrow();
  });

  it('pribavlja token preko client_credentials grant-a i dodaje Bearer header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'abc123', expires_in: 3600 }),
    });
    const strategy = new OAuth2ClientCredentialsStrategy('https://x.com/token', 'id', 'secret', fetchMock as any);

    await strategy.refreshIfNeeded();
    const result = strategy.applyAuth({ headers: {} });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://x.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.headers.Authorization).toBe('Bearer abc123');
  });

  it('ne poziva token endpoint ponovo dok važeći token nije istekao', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'abc123', expires_in: 3600 }),
    });
    const strategy = new OAuth2ClientCredentialsStrategy('https://x.com/token', 'id', 'secret', fetchMock as any);

    await strategy.refreshIfNeeded();
    await strategy.refreshIfNeeded();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('baca grešku kad token endpoint vrati ne-2xx status', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const strategy = new OAuth2ClientCredentialsStrategy('https://x.com/token', 'id', 'secret', fetchMock as any);

    await expect(strategy.refreshIfNeeded()).rejects.toThrow();
  });
});

describe('RequestSigningStrategy', () => {
  it('dodaje X-Api-Key, X-Timestamp i X-Signature header-e', () => {
    const strategy = new RequestSigningStrategy('kljuc', 'tajna');
    const result = strategy.applyAuth({ headers: {}, body: { a: 1 } });

    expect(result.headers['X-Api-Key']).toBe('kljuc');
    expect(result.headers['X-Timestamp']).toBeDefined();
    expect(result.headers['X-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('daje različit potpis za različit sadržaj tela', () => {
    const strategy = new RequestSigningStrategy('kljuc', 'tajna');
    const sigA = strategy.applyAuth({ headers: {}, body: { a: 1 } }).headers['X-Signature'];
    const sigB = strategy.applyAuth({ headers: {}, body: { a: 2 } }).headers['X-Signature'];
    expect(sigA).not.toBe(sigB);
  });
});

describe('SessionTokenStrategy (M4 spec §2.2 — Solvex-stil GUID token)', () => {
  it('baca grešku ako se applyAuth pozove pre refreshIfNeeded/login', () => {
    const strategy = new SessionTokenStrategy(async () => 'guid-1');
    expect(() => strategy.applyAuth({ headers: {} })).toThrow();
  });

  it('refreshIfNeeded poziva login samo jednom dok je token važeći', async () => {
    const login = jest.fn().mockResolvedValue('guid-1');
    const strategy = new SessionTokenStrategy(login);

    await strategy.refreshIfNeeded();
    await strategy.refreshIfNeeded();

    expect(login).toHaveBeenCalledTimes(1);
  });

  it('ubacuje token u telo zahteva (ne header), na deklarisano ime parametra', async () => {
    const strategy = new SessionTokenStrategy(async () => 'guid-1', 'GUID');
    await strategy.refreshIfNeeded();

    const result = strategy.applyAuth({ headers: {}, body: { other: 'x' } });
    expect(result.body).toEqual({ other: 'x', GUID: 'guid-1' });
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('invalidateToken forsira ponovni login pri sledećem refreshIfNeeded (reaktivno, ne na raspored)', async () => {
    const login = jest.fn().mockResolvedValueOnce('guid-1').mockResolvedValueOnce('guid-2');
    const strategy = new SessionTokenStrategy(login);

    await strategy.refreshIfNeeded();
    strategy.invalidateToken();
    await strategy.refreshIfNeeded();

    expect(login).toHaveBeenCalledTimes(2);
    expect(strategy.applyAuth({ headers: {} }).body?.GUID).toBe('guid-2');
  });
});
