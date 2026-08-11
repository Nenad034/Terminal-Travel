import { AuthStrategy, OutgoingRequest } from './auth-strategy.interface';

/**
 * M4 spec §2.2 — provajder izlaže login poziv koji vraća kratkoživeći token (GUID);
 * taj token ide kao parametar u telu zahteva (ne header), na mesto koje adapter
 * deklariše (`paramName`). `refreshIfNeeded()` ne osvežava na fiksni raspored — token
 * je nevažeći tek kad provajder to javi (`invalidateToken()`, koji adapter zove posle
 * prepoznavanja greške tipa "nevažeći token").
 */
export class SessionTokenStrategy implements AuthStrategy {
  readonly strategyType = 'SESSION_TOKEN' as const;

  private token: string | null = null;

  constructor(
    private readonly login: () => Promise<string>,
    private readonly paramName: string = 'GUID',
  ) {}

  applyAuth(request: OutgoingRequest): OutgoingRequest {
    if (!this.token) {
      throw new Error('Session token not obtained — call refreshIfNeeded() before applyAuth()');
    }
    return { ...request, body: { ...request.body, [this.paramName]: this.token } };
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.token) return;
    this.token = await this.login();
  }

  /** Poziva adapter posle greške tipa "nevažeći token" — sledeći refreshIfNeeded() ponovo loguje. */
  invalidateToken(): void {
    this.token = null;
  }
}
