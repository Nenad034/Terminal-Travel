import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { encryptSecret } from '../../../common/crypto/secret-box';
import { CreateChannelConfigDto } from './dto/create-channel-config.dto';
import { UpdateChannelConfigDto } from './dto/update-channel-config.dto';

// M12 spec §4 — "kredencijali ... čuvaju se enkriptovano, isti obrazac kao ProviderConfig.auth_config_encrypted
// u M4". Nikad vraćati auth_config_encrypted u odgovoru API-ja, isti princip kao M4.
function omitSecret<T extends { authConfigEncrypted: string | null }>(config: T): Omit<T, 'authConfigEncrypted'> {
  const { authConfigEncrypted, ...rest } = config;
  void authConfigEncrypted;
  return rest;
}

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const configs = await this.prisma.channelConfig.findMany({ orderBy: { channelCode: 'asc' } });
    return configs.map(omitSecret);
  }

  async findOne(channelCode: string) {
    const config = await this.prisma.channelConfig.findUniqueOrThrow({ where: { channelCode: channelCode as any } });
    return omitSecret(config);
  }

  async create(dto: CreateChannelConfigDto, actorId: string) {
    const config = await this.prisma.channelConfig.create({
      data: {
        channelCode: dto.channelCode,
        displayName: dto.displayName,
        authConfigEncrypted: dto.authConfig ? encryptSecret(JSON.stringify(dto.authConfig)) : null,
        status: 'INACTIVE',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'channel_config.created',
      resourceType: 'ChannelConfig',
      resourceId: config.id,
      afterState: omitSecret(config),
      context: {},
    });
    return omitSecret(config);
  }

  async update(channelCode: string, dto: UpdateChannelConfigDto, actorId: string) {
    const before = await this.prisma.channelConfig.findUniqueOrThrow({ where: { channelCode: channelCode as any } });
    const after = await this.prisma.channelConfig.update({
      where: { channelCode: channelCode as any },
      data: {
        displayName: dto.displayName,
        authConfigEncrypted: dto.authConfig ? encryptSecret(JSON.stringify(dto.authConfig)) : undefined,
        status: dto.status,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M12',
      action: 'channel_config.updated',
      resourceType: 'ChannelConfig',
      resourceId: after.id,
      beforeState: omitSecret(before),
      afterState: omitSecret(after),
      context: {},
    });
    return omitSecret(after);
  }
}
