import { Injectable } from '@nestjs/common';
import { CircuitState, ProviderConfig } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

/**
 * M4 spec §4.1 — circuit breaker po provajderu. CLOSED (normalno) → OPEN (posle
 * `circuit_failure_threshold` uzastopnih grešaka, M4 prestaje da zove) → HALF_OPEN
 * (posle `circuit_cooldown_seconds`, propušta tačno jedan probni poziv) → CLOSED
 * (uspeh) ili opet OPEN (neuspeh, novo odbrojavanje).
 */
@Injectable()
export class CircuitBreakerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Da li je trenutno dozvoljeno zvati provajdera — i po potrebi prevodi OPEN → HALF_OPEN kad cooldown istekne. */
  async canCall(config: ProviderConfig): Promise<{ allowed: boolean; effectiveState: CircuitState }> {
    if (config.circuitState === 'CLOSED') return { allowed: true, effectiveState: 'CLOSED' };

    if (config.circuitState === 'OPEN') {
      const cooldownElapsed =
        config.circuitOpenedAt &&
        Date.now() - config.circuitOpenedAt.getTime() >= config.circuitCooldownSeconds * 1000;
      if (!cooldownElapsed) return { allowed: false, effectiveState: 'OPEN' };

      await this.prisma.providerConfig.update({
        where: { providerCode: config.providerCode },
        data: { circuitState: 'HALF_OPEN' },
      });
      return { allowed: true, effectiveState: 'HALF_OPEN' };
    }

    // HALF_OPEN — propušta probni poziv.
    return { allowed: true, effectiveState: 'HALF_OPEN' };
  }

  async recordSuccess(providerCode: string): Promise<void> {
    await this.prisma.providerConfig.update({
      where: { providerCode },
      data: { circuitState: 'CLOSED', circuitConsecutiveFailures: 0, circuitOpenedAt: null },
    });
  }

  async recordFailure(providerCode: string): Promise<void> {
    const config = await this.prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });

    // §4.1 — probni poziv u HALF_OPEN koji ne uspe odmah vraća kolo u OPEN sa novim
    // odbrojavanjem, bez čekanja da brojač ponovo dostigne prag.
    if (config.circuitState === 'HALF_OPEN') {
      await this.prisma.providerConfig.update({
        where: { providerCode },
        data: {
          circuitState: 'OPEN',
          circuitConsecutiveFailures: config.circuitFailureThreshold,
          circuitOpenedAt: new Date(),
        },
      });
      await this.eventBus.emit('M4', 'provider_error_spike', { providerCode });
      return;
    }

    const failures = config.circuitConsecutiveFailures + 1;
    const opensNow = failures >= config.circuitFailureThreshold;

    await this.prisma.providerConfig.update({
      where: { providerCode },
      data: {
        circuitConsecutiveFailures: failures,
        circuitState: opensNow ? 'OPEN' : config.circuitState,
        circuitOpenedAt: opensNow ? new Date() : config.circuitOpenedAt,
      },
    });

    if (opensNow) {
      // M4 spec §4.1 — "generiše HealthSignal (M18, PROVIDER_ERROR_SPIKE)". M18 još ne
      // postoji kao model — preko Event Bus-a, isti obrazac kao M3 §4.3 nizak kapacitet.
      await this.eventBus.emit('M4', 'provider_error_spike', { providerCode });
    }
  }
}
