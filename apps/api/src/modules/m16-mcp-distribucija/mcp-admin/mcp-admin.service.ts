import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { hashToken, generateRawToken } from '../../../common/crypto/secret-box';
import { CreateMcpClientDto } from './dto/create-mcp-client.dto';

// M16 spec §3.1 — nikad vraćati credentials_encrypted u odgovoru (isti princip kao M4
// ProviderConfig.authConfigEncrypted).
function omitSecret<T extends { credentialsEncrypted: string }>(client: T): Omit<T, 'credentialsEncrypted'> {
  const { credentialsEncrypted, ...rest } = client;
  void credentialsEncrypted;
  return rest;
}

@Injectable()
export class McpAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const clients = await this.prisma.mCPClientRegistration.findMany({ orderBy: { createdAt: 'desc' } });
    return clients.map(omitSecret);
  }

  async findOne(id: string) {
    const client = await this.prisma.mCPClientRegistration.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`MCPClientRegistration ${id} nije pronađen.`);
    return omitSecret(client);
  }

  // M16 spec §3.1 — "Novi MCP klijent počinje kao PENDING/READ_ONLY". Plaintext kredencijal
  // se vraća TAČNO OVDE, jedini put — posle ovoga se samo heš čuva, ne postoji način da se
  // ponovo prikaže (isti obrazac kao izdavanje API ključa).
  async create(dto: CreateMcpClientDto, actorId: string) {
    const rawCredential = generateRawToken();
    const client = await this.prisma.mCPClientRegistration.create({
      data: {
        clientName: dto.clientName,
        credentialsEncrypted: hashToken(rawCredential),
        accessLevel: dto.accessLevel ?? 'READ_ONLY',
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
        status: 'PENDING',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M16',
      action: 'mcp_client.created',
      resourceType: 'MCPClientRegistration',
      resourceId: client.id,
      afterState: omitSecret(client),
      context: {},
    });
    return { ...omitSecret(client), credential: rawCredential };
  }

  // M16 spec §3.1 dopuna (implementacija) — PENDING→ACTIVE atomski kreira pratećeg
  // AI_AGENT User-a i LEGAL_ENTITY ClientAccount preko kojih MCP alati pozivaju M5 servise
  // in-process (isti "sopstveni pool rezervacija" obrazac kao SUBAGENT_CONTACT, M7).
  async activate(id: string, actorId: string) {
    const before = await this.prisma.mCPClientRegistration.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`MCPClientRegistration ${id} nije pronađen.`);
    if (before.status !== 'PENDING') {
      throw new BadRequestException(`Samo PENDING klijent može preći u ACTIVE (trenutni status: ${before.status}).`);
    }

    const clientAccount = await this.prisma.clientAccount.create({
      data: { accountType: 'LEGAL_ENTITY', companyName: before.clientName },
    });
    const user = await this.prisma.user.create({
      data: {
        email: `mcp-client+${before.id}@internal.terminal-travel.rs`,
        fullName: before.clientName,
        accountType: 'AI_AGENT',
        linkedProfileId: clientAccount.id,
        status: 'ACTIVE',
      },
    });

    const after = await this.prisma.mCPClientRegistration.update({
      where: { id },
      data: { status: 'ACTIVE', linkedUserId: user.id, linkedClientAccountId: clientAccount.id },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M16',
      action: 'mcp_client.activated',
      resourceType: 'MCPClientRegistration',
      resourceId: id,
      beforeState: omitSecret(before),
      afterState: omitSecret(after),
      context: { linkedUserId: user.id, linkedClientAccountId: clientAccount.id },
    });
    return omitSecret(after);
  }

  // M16 spec §3.1/§7 — "prelazak na READ_WRITE ... zahteva ručno odobrenje Vlasnika/Direktora",
  // nikad automatski. Izlazni kriterijum, stavka 3 — mora biti upisano u audit log.
  async approveReadWrite(id: string, actorId: string) {
    const before = await this.prisma.mCPClientRegistration.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`MCPClientRegistration ${id} nije pronađen.`);
    if (before.status !== 'ACTIVE') {
      throw new BadRequestException('Klijent mora biti ACTIVE pre odobrenja READ_WRITE pristupa.');
    }
    if (before.accessLevel === 'READ_WRITE') return omitSecret(before);

    const after = await this.prisma.mCPClientRegistration.update({
      where: { id },
      data: { accessLevel: 'READ_WRITE' },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M16',
      action: 'mcp_client.approved_read_write',
      resourceType: 'MCPClientRegistration',
      resourceId: id,
      beforeState: omitSecret(before),
      afterState: omitSecret(after),
      context: {},
    });
    return omitSecret(after);
  }

  async suspend(id: string, actorId: string) {
    const before = await this.prisma.mCPClientRegistration.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`MCPClientRegistration ${id} nije pronađen.`);

    const after = await this.prisma.mCPClientRegistration.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M16',
      action: 'mcp_client.suspended',
      resourceType: 'MCPClientRegistration',
      resourceId: id,
      beforeState: omitSecret(before),
      afterState: omitSecret(after),
      context: {},
    });
    return omitSecret(after);
  }
}
