import { AuthStrategy, OutgoingRequest } from './auth-strategy.interface';

export class ApiKeyStrategy implements AuthStrategy {
  readonly strategyType = 'API_KEY' as const;

  constructor(
    private readonly apiKey: string,
    private readonly headerName: string = 'X-Api-Key',
  ) {}

  applyAuth(request: OutgoingRequest): OutgoingRequest {
    return { ...request, headers: { ...request.headers, [this.headerName]: this.apiKey } };
  }

  async refreshIfNeeded(): Promise<void> {
    // no-op (M4 spec §2.2)
  }
}
