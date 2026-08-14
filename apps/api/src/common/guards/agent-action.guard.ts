import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AGENT_ACTION_KEY, RequiredAgentAction } from '../decorators/agent-action.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M15 spec §5 — "Pre izvršenja bilo koje akcije čiji je actor_type = AI_AGENT, API sloj
 * proverava AgentActionType.tier za tu akciju." Ova provera je namerno nezavisna od M1 RBAC-a
 * (isti "defense in depth" princip kao ModuleActivationService.update) — čak i ako bi neka
 * buduća greška dodelila AI agentu M1 dozvolu za rutu, ovaj guard i dalje odbija zahtev.
 *
 * Pravilo važi ISKLJUČIVO za AI_AGENT pozivaoce — ljudski korisnici prolaze nepromenjeno,
 * njihova prava i dalje sprovodi isključivo PermissionsGuard.
 */
@Injectable()
export class AgentActionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredAgentAction | undefined>(AGENT_ACTION_KEY, context.getHandler());
    if (!required) return true; // ruta bez @AgentAction — ovaj guard se ne primenjuje

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    if (!userId) return true; // JwtAuthGuard već odbija neautentikovane zahteve

    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!actor || actor.accountType !== 'AI_AGENT') return true; // §5 pravilo važi samo za AI agente

    const actionType = await this.prisma.agentActionType.findFirst({
      where: { moduleCode: required.moduleCode, actionCode: required.actionCode },
    });

    // Nedostatak registracije je bezbedan podrazumevani ishod — blokira, ne propušta
    // (isti princip kao registar poglavlja 4: "ne postoji podrazumevani nivo").
    if (!actionType || actionType.tier !== 'AUTONOMOUS') {
      throw new ForbiddenException(
        `AI agent ne sme da izvrši akciju ${required.actionCode} (M15 spec §5 — tier ${actionType?.tier ?? 'nije registrovana u AgentActionType'}).`,
      );
    }

    return true;
  }
}
