import { AuthStrategy, OutgoingRequest } from './auth-strategy.interface';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class OAuth2ClientCredentialsStrategy implements AuthStrategy {
  readonly strategyType = 'OAUTH2_CLIENT_CREDENTIALS' as const;

  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly tokenUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  applyAuth(request: OutgoingRequest): OutgoingRequest {
    if (!this.accessToken) {
      throw new Error('OAuth2 token not obtained — call refreshIfNeeded() before applyAuth()');
    }
    return { ...request, headers: { ...request.headers, Authorization: `Bearer ${this.accessToken}` } };
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.accessToken && Date.now() < this.expiresAt) return;

    const res = await this.fetchFn(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`OAuth2 token request failed: ${res.status}`);
    }
    const data = (await res.json()) as TokenResponse;
    this.accessToken = data.access_token;
    // Osveži malo pre stvarnog isteka (60s margina) da izbegnemo poziv sa istekom "na ivici".
    this.expiresAt = Date.now() + Math.max(data.expires_in - 60, 0) * 1000;
  }
}
