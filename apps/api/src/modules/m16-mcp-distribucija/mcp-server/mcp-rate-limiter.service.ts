import { Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;

/**
 * M16 spec §6 — rate_limit_per_minute po MCPClientRegistration. U memoriji (isti stil kao
 * M4 CircuitBreakerService), dovoljno za jednu instancu API-ja; nije potreban DB upis po
 * pozivu. Fiksni 60s prozor koji se resetuje čim istekne, ne klizni prozor — jednostavnije
 * i dovoljno za "zaštita od zloupotrebe" cilj spec-a.
 */
@Injectable()
export class McpRateLimiterService {
  private readonly windows = new Map<string, { windowStart: number; count: number }>();

  /** Vraća true ako je poziv dozvoljen (i beleži ga); false ako je limit dostignut. */
  tryConsume(registrationId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const existing = this.windows.get(registrationId);
    if (!existing || now - existing.windowStart >= WINDOW_MS) {
      this.windows.set(registrationId, { windowStart: now, count: 1 });
      return true;
    }
    if (existing.count >= limitPerMinute) return false;
    existing.count += 1;
    return true;
  }
}
