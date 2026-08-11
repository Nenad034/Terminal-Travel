import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../m1-core-identitet/audit-log/audit-log.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ProviderRegistryService } from './provider-registry.service';
import {
  AvailabilityQuote,
  BookingConfirmation,
  BookingRequest,
  CancellationResult,
  NormalizedContent,
  NormalizedSearchResult,
  ProviderError,
  ProviderErrorCode,
  SearchParams,
  StayParams,
} from './provider-adapter.interface';

const SENSITIVE_KEYS = ['password', 'login', 'GUID', 'apiKey', 'guestName'];

// M4 spec §3.2/§7 tačka 5 Master dokumenta — request_summary bez ličnih/osetljivih podataka.
function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_KEYS.includes(key) ? '[REDACTED]' : value;
  }
  return clone;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly registry: ProviderRegistryService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async logCall(params: {
    providerCode: string;
    operation: 'SEARCH' | 'CONTENT' | 'AVAILABILITY' | 'BOOK' | 'CANCEL';
    requestSummary: Record<string, unknown>;
    responseStatus: string;
    errorCode?: ProviderErrorCode;
    errorMessage?: string;
    latencyMs: number;
    idempotencyKey?: string;
    responseBody?: unknown;
  }) {
    return this.prisma.providerCallLog.create({
      data: {
        providerCode: params.providerCode,
        operation: params.operation,
        requestSummary: redact(params.requestSummary) as any,
        responseStatus: params.responseStatus,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        latencyMs: params.latencyMs,
        idempotencyKey: params.idempotencyKey,
        responseBody: params.responseBody as any,
      },
    });
  }

  /** M4 spec §4.1 — kolo OPEN znači M4 prestaje da zove provajdera dok cooldown ne istekne. */
  private async assertCircuitAllows(providerCode: string, operation: 'SEARCH' | 'CONTENT' | 'AVAILABILITY' | 'BOOK' | 'CANCEL') {
    const config = await this.prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });
    const gate = await this.circuitBreaker.canCall(config);
    if (!gate.allowed) {
      await this.logCall({
        providerCode,
        operation,
        requestSummary: {},
        responseStatus: 'CIRCUIT_OPEN',
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: 'Circuit breaker OPEN',
        latencyMs: 0,
      });
      throw new ProviderError('PROVIDER_UNAVAILABLE', `Provider ${providerCode} je trenutno isključen (circuit OPEN, M4 spec §4.1)`);
    }
    return config;
  }

  async search(providerCode: string, params: SearchParams): Promise<NormalizedSearchResult[]> {
    const config = await this.assertCircuitAllows(providerCode, 'SEARCH');
    const adapter = this.registry.getAdapter(config);
    const start = Date.now();
    try {
      const raw = await adapter.search(params);
      // M4 spec §2.4 — search() nikad ne vraća više od capabilities_profile.maxResultsPerSearch (podrazumevano 50).
      const maxResults = (config.capabilitiesProfile as { maxResultsPerSearch?: number })?.maxResultsPerSearch ?? 50;
      const results = raw.slice(0, maxResults);

      await this.circuitBreaker.recordSuccess(providerCode);
      await this.logCall({ providerCode, operation: 'SEARCH', requestSummary: params as any, responseStatus: 'OK', latencyMs: Date.now() - start });
      return results;
    } catch (err) {
      await this.handleFailure(providerCode, 'SEARCH', params as any, start, err);
      throw err;
    }
  }

  async getStaticContent(providerCode: string, externalId: string): Promise<NormalizedContent> {
    const config = await this.assertCircuitAllows(providerCode, 'CONTENT');
    const adapter = this.registry.getAdapter(config);
    const start = Date.now();
    try {
      const content = await adapter.getStaticContent(externalId);
      await this.circuitBreaker.recordSuccess(providerCode);
      await this.logCall({ providerCode, operation: 'CONTENT', requestSummary: { externalId }, responseStatus: 'OK', latencyMs: Date.now() - start });
      return content;
    } catch (err) {
      await this.handleFailure(providerCode, 'CONTENT', { externalId }, start, err);
      throw err;
    }
  }

  async checkAvailabilityAndPrice(providerCode: string, externalId: string, stay: StayParams): Promise<AvailabilityQuote> {
    const config = await this.assertCircuitAllows(providerCode, 'AVAILABILITY');
    const adapter = this.registry.getAdapter(config);
    const start = Date.now();
    try {
      const quote = await adapter.checkAvailabilityAndPrice(externalId, stay);
      await this.circuitBreaker.recordSuccess(providerCode);
      await this.logCall({ providerCode, operation: 'AVAILABILITY', requestSummary: { externalId, stay } as any, responseStatus: 'OK', latencyMs: Date.now() - start });
      return quote;
    } catch (err) {
      await this.handleFailure(providerCode, 'AVAILABILITY', { externalId, stay } as any, start, err);
      throw err;
    }
  }

  /**
   * M4 spec §4 — idempotentnost: pre bilo kog (ponovnog) pokušaja, prvo se proverava
   * `ProviderCallLog` da li je taj `idempotency_key` već uspešno poslat, umesto da se
   * poziv automatski ponovi (mrežni timeout ne znači da poziv nije uspeo kod provajdera).
   */
  async confirmBooking(providerCode: string, externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    const existing = await this.prisma.providerCallLog.findFirst({
      where: { providerCode, operation: 'BOOK', idempotencyKey: booking.idempotencyKey, errorCode: null },
      orderBy: { timestamp: 'desc' },
    });
    if (existing?.responseBody) {
      return existing.responseBody as unknown as BookingConfirmation;
    }

    const config = await this.assertCircuitAllows(providerCode, 'BOOK');
    const adapter = this.registry.getAdapter(config);
    const start = Date.now();
    try {
      const confirmation = await adapter.confirmBooking(externalId, booking);
      await this.circuitBreaker.recordSuccess(providerCode);
      await this.logCall({
        providerCode,
        operation: 'BOOK',
        requestSummary: { externalId, stay: booking.stay } as any,
        responseStatus: 'OK',
        latencyMs: Date.now() - start,
        idempotencyKey: booking.idempotencyKey,
        responseBody: confirmation,
      });
      // M4 spec §3.2 — "Svaki uspešan/neuspešan BOOK/CANCEL poziv dodatno upisuje zapis i u M1 AuditLogEntry".
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M4',
        action: 'provider_booking.confirmed',
        resourceType: 'ProviderCallLog',
        resourceId: booking.idempotencyKey,
        afterState: confirmation,
        context: { providerCode, externalId },
      });
      return confirmation;
    } catch (err) {
      await this.handleFailure(providerCode, 'BOOK', { externalId, stay: booking.stay } as any, start, err, booking.idempotencyKey);
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M4',
        action: 'provider_booking.failed',
        resourceType: 'ProviderCallLog',
        resourceId: booking.idempotencyKey,
        context: { providerCode, externalId, error: (err as Error).message },
      });
      throw err;
    }
  }

  async cancelBooking(providerCode: string, providerBookingReference: string): Promise<CancellationResult> {
    const config = await this.assertCircuitAllows(providerCode, 'CANCEL');
    const adapter = this.registry.getAdapter(config);
    const start = Date.now();
    try {
      const result = await adapter.cancelBooking(providerBookingReference);
      await this.circuitBreaker.recordSuccess(providerCode);
      await this.logCall({ providerCode, operation: 'CANCEL', requestSummary: { providerBookingReference }, responseStatus: 'OK', latencyMs: Date.now() - start });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M4',
        action: 'provider_booking.cancelled',
        resourceType: 'ProviderCallLog',
        resourceId: providerBookingReference,
        afterState: result,
        context: { providerCode },
      });
      return result;
    } catch (err) {
      await this.handleFailure(providerCode, 'CANCEL', { providerBookingReference }, start, err);
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M4',
        action: 'provider_booking.cancel_failed',
        resourceType: 'ProviderCallLog',
        resourceId: providerBookingReference,
        context: { providerCode, error: (err as Error).message },
      });
      throw err;
    }
  }

  private async handleFailure(
    providerCode: string,
    operation: 'SEARCH' | 'CONTENT' | 'AVAILABILITY' | 'BOOK' | 'CANCEL',
    requestSummary: Record<string, unknown>,
    start: number,
    err: unknown,
    idempotencyKey?: string,
  ) {
    // M4 spec §3.2 — "Svaki zapis u ProviderCallLog ima popunjen normalizovan error_code
    // kad poziv ne uspe, nezavisno od stvarnog HTTP/GraphQL statusa provajdera."
    const code: ProviderErrorCode = err instanceof ProviderError ? err.code : 'UNKNOWN';
    await this.circuitBreaker.recordFailure(providerCode);
    await this.logCall({
      providerCode,
      operation,
      requestSummary,
      responseStatus: 'ERROR',
      errorCode: code,
      errorMessage: (err as Error).message,
      latencyMs: Date.now() - start,
      idempotencyKey,
    });
  }
}
