import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

// M15 spec §3 — "uvek ljudska odluka" (Vlasnik/Direktor). Ograda na nivou koda je dvostruka:
// M1 dozvola (M15/module-activation/ACTIVATE, dodeljena samo tim ulogama, sprovodi je
// PermissionsGuard u kontroleru) I OVDE, ponovo, provera da actor_type nikad nije AI_AGENT —
// isti "defense in depth" princip kao §5 ("nezavisno redundantno sa M1 RBAC-om").
@Injectable()
export class ModuleActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(moduleCode: string) {
    const activation = await this.prisma.moduleAgentActivation.findUnique({ where: { moduleCode } });
    if (!activation) throw new NotFoundException(`Nepoznat module_code: ${moduleCode}`);
    return activation;
  }

  async update(moduleCode: string, status: 'NOT_READY' | 'READY_FOR_ACTIVATION' | 'ACTIVATED', actorUserId: string) {
    const actor = await this.prisma.user.findUniqueOrThrow({ where: { id: actorUserId } });
    // §3/§5 — defense in depth: čak i kad bi neka buduća greška dodelila AI agentu ovu M1
    // dozvolu, ova provera i dalje odbija zahtev na nivou koda.
    if (actor.accountType === 'AI_AGENT') {
      throw new ForbiddenException('Aktivacija modula je uvek ljudska odluka — AI agent ne sme da je izvrši.');
    }

    const before = await this.prisma.moduleAgentActivation.findUnique({ where: { moduleCode } });
    if (!before) throw new NotFoundException(`Nepoznat module_code: ${moduleCode}`);

    const after = await this.prisma.moduleAgentActivation.update({
      where: { moduleCode },
      data: {
        status,
        activatedBy: status === 'ACTIVATED' ? actorUserId : before.activatedBy,
        activatedAt: status === 'ACTIVATED' ? new Date() : before.activatedAt,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M15',
      action: 'module-activation.update',
      resourceType: 'ModuleAgentActivation',
      resourceId: moduleCode,
      beforeState: before,
      afterState: after,
    });

    return after;
  }
}
