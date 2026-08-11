import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { encryptSecret } from '../../../common/crypto/secret-box';
import { CreateProviderConfigDto } from './dto/create-provider-config.dto';
import { UpdateProviderConfigDto } from './dto/update-provider-config.dto';
import { ProviderRegistryService } from '../provider-registry.service';

// Nikad vraćati auth_config_encrypted u odgovoru API-ja (M4 spec §9 — kredencijali nikad u logu/odgovoru).
function omitSecret<T extends { authConfigEncrypted: string }>(config: T): Omit<T, 'authConfigEncrypted'> {
  const { authConfigEncrypted, ...rest } = config;
  void authConfigEncrypted;
  return rest;
}

@Injectable()
export class ProviderConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly registry: ProviderRegistryService,
  ) {}

  async findAll() {
    const configs = await this.prisma.providerConfig.findMany({ orderBy: { providerCode: 'asc' } });
    return configs.map(omitSecret);
  }

  async findOne(providerCode: string) {
    const config = await this.prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });
    return omitSecret(config);
  }

  async create(dto: CreateProviderConfigDto, actorId: string) {
    const config = await this.prisma.providerConfig.create({
      data: {
        providerCode: dto.providerCode,
        displayName: dto.displayName,
        category: dto.category,
        authConfigEncrypted: encryptSecret(JSON.stringify(dto.authConfig)),
        authStrategy: dto.authStrategy,
        capabilitiesProfile: (dto.capabilitiesProfile ?? {}) as any,
        timeoutSearchMs: dto.timeoutSearchMs,
        timeoutBookingMs: dto.timeoutBookingMs,
        circuitFailureThreshold: dto.circuitFailureThreshold,
        circuitCooldownSeconds: dto.circuitCooldownSeconds,
        defaultTipNastupanja: dto.defaultTipNastupanja,
        status: 'INACTIVE',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M4',
      action: 'provider_config.created',
      resourceType: 'ProviderConfig',
      resourceId: config.id,
      afterState: omitSecret(config),
      context: {},
    });
    return omitSecret(config);
  }

  // M4 spec §3.1/§8 — "ProviderConfig ne može preći u ACTIVE bez popunjenog default_tip_nastupanja",
  // isto sprovođenje kao M3 Contract (§2.2a).
  async update(providerCode: string, dto: UpdateProviderConfigDto, actorId: string) {
    const before = await this.prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });

    if (dto.status === 'ACTIVE' && before.status !== 'ACTIVE') {
      const effectiveTip = dto.defaultTipNastupanja ?? before.defaultTipNastupanja;
      if (!effectiveTip) {
        throw new BadRequestException(
          'ProviderConfig ne može preći u ACTIVE bez popunjenog default_tip_nastupanja (M4 spec §3.1)',
        );
      }
    }

    const after = await this.prisma.providerConfig.update({
      where: { providerCode },
      data: {
        authConfigEncrypted: dto.authConfig ? encryptSecret(JSON.stringify(dto.authConfig)) : undefined,
        capabilitiesProfile: dto.capabilitiesProfile as any,
        status: dto.status,
        defaultTipNastupanja: dto.defaultTipNastupanja,
        timeoutSearchMs: dto.timeoutSearchMs,
        timeoutBookingMs: dto.timeoutBookingMs,
        useMock: dto.useMock,
      },
    });
    // Kredencijali/mock-režim su se možda promenili — sledeći poziv mora graditi svežu instancu.
    this.registry.invalidate(providerCode);
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M4',
      action: 'provider_config.updated',
      resourceType: 'ProviderConfig',
      resourceId: after.id,
      beforeState: omitSecret(before),
      afterState: omitSecret(after),
      context: {},
    });
    return omitSecret(after);
  }
}
