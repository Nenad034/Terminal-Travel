import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ProcessMapDefinition } from './definitions/process-map.types';
import { M1_SECURITY_PROCESS_MAP } from './definitions/m1-security.definition';

const REGISTRY: ProcessMapDefinition[] = [M1_SECURITY_PROCESS_MAP];

const DEFAULT_WINDOW_MINUTES = 1440;

export interface ProcessMapNodeLive {
  id: string;
  label: string;
  count: number;
  // AuditLogService.find() vraća najviše 200 zapisa — ako je count===200, stvaran broj u
  // prozoru može biti veći (namerno vidljivo, ne tiho pogrešan broj, isti princip "bez tihog
  // ograničenja" kao svaka druga lista u ovom sistemu).
  capped: boolean;
  lastAt: string | null;
}

@Injectable()
export class ProcessMapsService {
  constructor(private readonly auditLog: AuditLogService) {}

  // M18 spec §9a — katalog bez brojeva, za listu kartica u panelu.
  findAll(): ProcessMapDefinition[] {
    return REGISTRY;
  }

  private findDefinition(key: string): ProcessMapDefinition {
    const definition = REGISTRY.find((d) => d.key === key);
    if (!definition) throw new NotFoundException(`Procesna mapa "${key}" nije registrovana (M18 spec §9a)`);
    return definition;
  }

  // M18 spec §9a — broj i vreme poslednjeg zapisa po čvoru, u datom vremenskom prozoru.
  // Čita direktno iz M1 audit loga (isti obrazac kao AiProviderQuotaService), ne duplira
  // podatak — mapa je samo prikaz nad postojećim, nepromenjivim izvorom istine.
  async live(key: string, windowMinutes: number = DEFAULT_WINDOW_MINUTES): Promise<{ key: string; label: string; nodes: ProcessMapNodeLive[] }> {
    const definition = this.findDefinition(key);
    const from = new Date(Date.now() - windowMinutes * 60_000);

    const nodes = await Promise.all(
      definition.nodes.map(async (node) => {
        const entries = await this.auditLog.find({ module: definition.module, actions: node.matchActions, from });
        return {
          id: node.id,
          label: node.label,
          count: entries.length,
          capped: entries.length === 200,
          lastAt: entries.length > 0 ? entries[0].timestamp.toISOString() : null,
        };
      }),
    );

    return { key: definition.key, label: definition.label, nodes };
  }
}
