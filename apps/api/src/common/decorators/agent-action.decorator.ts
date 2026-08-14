import { SetMetadata } from '@nestjs/common';

export const AGENT_ACTION_KEY = 'requiredAgentAction';

export interface RequiredAgentAction {
  moduleCode: string | null;
  actionCode: string;
}

/**
 * M15 spec §4/§5 — vezuje endpoint za red u `AgentActionType` (moduleCode/actionCode).
 * `moduleCode: null` za "(globalno)" redove poglavlja 4 (npr. contract.sign, money.transfer).
 * Ne zamenjuje `@RequirePermission` — ovo je dodatna, nezavisna ograda koja važi SAMO kad je
 * pozivalac AI agent (`User.account_type = AI_AGENT`), sprovodi je `AgentActionGuard`.
 */
export const AgentAction = (moduleCode: string | null, actionCode: string) =>
  SetMetadata(AGENT_ACTION_KEY, { moduleCode, actionCode } as RequiredAgentAction);
