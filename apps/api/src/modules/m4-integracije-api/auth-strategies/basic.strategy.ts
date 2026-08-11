import { AuthStrategy, OutgoingRequest } from './auth-strategy.interface';

export class BasicAuthStrategy implements AuthStrategy {
  readonly strategyType = 'BASIC' as const;

  constructor(
    private readonly username: string,
    private readonly password: string,
  ) {}

  applyAuth(request: OutgoingRequest): OutgoingRequest {
    const token = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return { ...request, headers: { ...request.headers, Authorization: `Basic ${token}` } };
  }

  async refreshIfNeeded(): Promise<void> {
    // no-op (M4 spec §2.2)
  }
}
