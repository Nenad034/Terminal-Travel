import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentActionGuard } from './agent-action.guard';
import { AGENT_ACTION_KEY } from '../decorators/agent-action.decorator';

function makeContext(request: unknown) {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('AgentActionGuard (M15 spec §5 — sprovedba na nivou koda)', () => {
  it('propušta zahtev bez @AgentAction metadata bez čitanja baze', async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn() }, agentActionType: { findFirst: jest.fn() } };
    const guard = new AgentActionGuard(reflector, prisma as any);

    const result = await guard.canActivate(makeContext({ user: { userId: 'u1' } }));

    expect(result).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('propušta HUMAN aktera bez obzira na tier (pravilo važi samo za AI_AGENT)', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ moduleCode: 'M10', actionCode: 'fiscal_document.submit' }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', accountType: 'STAFF' }) },
      agentActionType: { findFirst: jest.fn() },
    };
    const guard = new AgentActionGuard(reflector, prisma as any);

    const result = await guard.canActivate(makeContext({ user: { userId: 'u1' } }));

    expect(result).toBe(true);
    expect(prisma.agentActionType.findFirst).not.toHaveBeenCalled();
  });

  it('odbija AI_AGENT aktera za NEVER_AUTONOMOUS akciju', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ moduleCode: 'M10', actionCode: 'fiscal_document.submit' }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'agent-1', accountType: 'AI_AGENT' }) },
      agentActionType: { findFirst: jest.fn().mockResolvedValue({ tier: 'NEVER_AUTONOMOUS' }) },
    };
    const guard = new AgentActionGuard(reflector, prisma as any);

    await expect(guard.canActivate(makeContext({ user: { userId: 'agent-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('odbija AI_AGENT aktera za PROPOSE_THEN_APPROVE akciju (ne sme sam da izvrši)', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ moduleCode: 'M12', actionCode: 'content.approve_publish' }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'agent-1', accountType: 'AI_AGENT' }) },
      agentActionType: { findFirst: jest.fn().mockResolvedValue({ tier: 'PROPOSE_THEN_APPROVE' }) },
    };
    const guard = new AgentActionGuard(reflector, prisma as any);

    await expect(guard.canActivate(makeContext({ user: { userId: 'agent-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('odbija AI_AGENT aktera kad akcija uopšte nije registrovana (bezbedan podrazumevani ishod)', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ moduleCode: 'M99', actionCode: 'nepostojeca.akcija' }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'agent-1', accountType: 'AI_AGENT' }) },
      agentActionType: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new AgentActionGuard(reflector, prisma as any);

    await expect(guard.canActivate(makeContext({ user: { userId: 'agent-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('propušta AI_AGENT aktera za AUTONOMOUS akciju', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ moduleCode: null, actionCode: 'omnisearch.query' }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'agent-1', accountType: 'AI_AGENT' }) },
      agentActionType: { findFirst: jest.fn().mockResolvedValue({ tier: 'AUTONOMOUS' }) },
    };
    const guard = new AgentActionGuard(reflector, prisma as any);

    const result = await guard.canActivate(makeContext({ user: { userId: 'agent-1' } }));

    expect(result).toBe(true);
    expect(prisma.agentActionType.findFirst).toHaveBeenCalledWith({ where: { moduleCode: null, actionCode: 'omnisearch.query' } });
  });
});
