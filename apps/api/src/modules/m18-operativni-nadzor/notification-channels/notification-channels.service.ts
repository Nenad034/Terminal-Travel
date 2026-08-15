import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { encryptSecret } from '../../../common/crypto/secret-box';
import { CreateNotificationChannelDto } from './dto/create-notification-channel.dto';
import { UpdateNotificationChannelDto } from './dto/update-notification-channel.dto';

// Nikad vraćati config_encrypted u odgovoru API-ja — isti obrazac kao M4 ProviderConfig
// (apps/api/src/modules/m4-integracije-api/provider-configs/provider-configs.service.ts).
function omitSecret<T extends { configEncrypted: string }>(channel: T): Omit<T, 'configEncrypted'> {
  const { configEncrypted, ...rest } = channel;
  void configEncrypted;
  return rest;
}

// M18 spec §3/§9 — CRUD za spoljne kanale dostave (Telegram/email/in-app).
@Injectable()
export class NotificationChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const channels = await this.prisma.notificationChannel.findMany({ orderBy: { createdAt: 'asc' } });
    return channels.map(omitSecret);
  }

  async findActive() {
    return this.prisma.notificationChannel.findMany({ where: { status: 'ACTIVE' } });
  }

  async create(dto: CreateNotificationChannelDto) {
    const channel = await this.prisma.notificationChannel.create({
      data: {
        channelType: dto.channelType,
        configEncrypted: encryptSecret(JSON.stringify(dto.config)),
        recipientRole: dto.recipientRole,
      },
    });
    return omitSecret(channel);
  }

  async update(id: string, dto: UpdateNotificationChannelDto) {
    const existing = await this.prisma.notificationChannel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`NotificationChannel ${id} nije pronađen.`);

    const channel = await this.prisma.notificationChannel.update({
      where: { id },
      data: {
        configEncrypted: dto.config ? encryptSecret(JSON.stringify(dto.config)) : undefined,
        recipientRole: dto.recipientRole,
        status: dto.status,
      },
    });
    return omitSecret(channel);
  }
}
