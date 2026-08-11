import { createHmac } from 'crypto';
import { AuthStrategy, OutgoingRequest } from './auth-strategy.interface';

/** M4 spec §2.2 — HMAC-SHA256 potpis nad telom zahteva + timestamp, generički obrazac. */
export class RequestSigningStrategy implements AuthStrategy {
  readonly strategyType = 'REQUEST_SIGNING' as const;

  constructor(
    private readonly apiKey: string,
    private readonly secret: string,
  ) {}

  applyAuth(request: OutgoingRequest): OutgoingRequest {
    const timestamp = Date.now().toString();
    const payload = `${timestamp}.${JSON.stringify(request.body ?? {})}`;
    const signature = createHmac('sha256', this.secret).update(payload).digest('hex');
    return {
      ...request,
      headers: {
        ...request.headers,
        'X-Api-Key': this.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
    };
  }

  async refreshIfNeeded(): Promise<void> {
    // no-op (M4 spec §2.2)
  }
}
