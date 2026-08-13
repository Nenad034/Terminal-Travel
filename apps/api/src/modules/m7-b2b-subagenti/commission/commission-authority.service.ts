import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';

/**
 * M7 spec §3 — "ko postavlja proviziju" (i pragove obima, §3.1, "isti autoritet kao za osnovnu
 * proviziju"): za Tier 1 subagenta isključivo Vlasnik/Direktor, za sub-subagenta isključivo
 * njegov roditeljski subagent. Deljeno između SubagentsService (PATCH .../commission) i
 * CommissionVolumeTiersService (POST/PATCH volume-tiers) da pravilo ostane na jednom mestu.
 *
 * NAMERNO koristi PrismaService direktno umesto SubagentsService — SubagentsModule uvozi
 * CommissionModule (za SubagentVolumeStatusService u kontroleru), pa bi obrnuta zavisnost ka
 * SubagentsService napravila kružnu zavisnost modula unutar iste feature celine (M7).
 */
@Injectable()
export class CommissionAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanManageCommissionFor(subagentId: string, actor: { userId: string }): Promise<void> {
    const identity = await resolveCallerIdentity(this.prisma, actor.userId);
    if (identity.accountType !== 'SUBAGENT_CONTACT') return; // interno osoblje — sprovodi se i preko @RequirePermission na kontroleru

    const subagent = await this.prisma.subagent.findUnique({ where: { id: subagentId } });
    if (!subagent) throw new NotFoundException(`Subagent ${subagentId} nije pronađen.`);
    if (subagent.parentSubagentId === null) {
      throw new ForbiddenException('Tier 1 proviziju/pragove postavlja isključivo agencija (M7 spec §3).');
    }
    if (identity.ownProfileId !== subagent.parentSubagentId) {
      throw new ForbiddenException('Proviziju/pragove sub-subagenta postavlja isključivo njegov roditeljski subagent (M7 spec §3).');
    }
  }
}
