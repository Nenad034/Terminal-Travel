import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateDestinationProfileDto } from './dto/create-destination-profile.dto';
import { UpdateDestinationProfileDto } from './dto/update-destination-profile.dto';

// M2 spec §2.1c (dopuna 5.9.2026) — DestinationProfile: tip destinacije + aktivnosti, tagovan
// JEDNOM po mestu (destination_country + destination_city), ne po proizvodu. Koristi ga M5
// §3.0c.3d (kontekstualni filteri po tipu destinacije/sezoni) i §3.0c.3e (pretraga po aktivnosti).
@Injectable()
export class DestinationProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.destinationProfile.findMany({
      orderBy: [{ destinationCountry: 'asc' }, { destinationCity: 'asc' }],
    });
  }

  // §2.1c — jedinstven par (destinationCountry, destinationCity); destinacija bez profila ne
  // postoji kao red ovde (tretira se kao "nepoznat tip" na strani pozivaoca, §2.1a princip).
  async findOne(destinationCountry: string, destinationCity: string) {
    return this.prisma.destinationProfile.findUnique({
      where: { destinationCountry_destinationCity: { destinationCountry, destinationCity } },
    });
  }

  async create(dto: CreateDestinationProfileDto, actorId: string) {
    const existing = await this.findOne(dto.destinationCountry, dto.destinationCity);
    if (existing) {
      throw new ConflictException(
        `Profil za ${dto.destinationCity}, ${dto.destinationCountry} već postoji (M2 spec §2.1c — najviše jedan profil po destinaciji).`,
      );
    }

    const profile = await this.prisma.destinationProfile.create({
      data: {
        destinationCountry: dto.destinationCountry,
        destinationCity: dto.destinationCity,
        destinationType: dto.destinationType,
        activities: dto.activities ?? [],
        createdBy: actorId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'destination_profile.created',
      resourceType: 'DestinationProfile',
      resourceId: profile.id,
      afterState: profile,
      context: {},
    });
    return profile;
  }

  async update(id: string, dto: UpdateDestinationProfileDto, actorId: string) {
    const before = await this.prisma.destinationProfile.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.destinationProfile.update({
      where: { id },
      data: {
        destinationType: dto.destinationType,
        activities: dto.activities as unknown as Prisma.DestinationProfileUpdateInput['activities'],
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'destination_profile.updated',
      resourceType: 'DestinationProfile',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }
}
