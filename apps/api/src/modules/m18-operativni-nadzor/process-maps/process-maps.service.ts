import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ProcessMapDefinition } from './definitions/process-map.types';
import { M1_SECURITY_PROCESS_MAP } from './definitions/m1-security.definition';
import { M5_BOOKING_FLOW_PROCESS_MAP } from './definitions/m5-booking-flow.definition';
import { M10_MONEY_FLOW_PROCESS_MAP } from './definitions/m10-money-flow.definition';
import { M7_SUBAGENT_FLOW_PROCESS_MAP } from './definitions/m7-subagent-flow.definition';

const REGISTRY: ProcessMapDefinition[] = [
  M1_SECURITY_PROCESS_MAP,
  M5_BOOKING_FLOW_PROCESS_MAP,
  M10_MONEY_FLOW_PROCESS_MAP,
  M7_SUBAGENT_FLOW_PROCESS_MAP,
];

const DEFAULT_WINDOW_MINUTES = 1440;

export interface ProcessMapNodeLive {
  id: string;
  label: string;
  /**
   * TAČAN broj događaja u prozoru — ne procena i ne gornja granica.
   *
   * Do 6.9.2026. ovde je stajao broj dobijen brojanjem povučenih redova, uz prateće polje
   * `capped: boolean` koje je značilo „stigli smo do 200, stvaran broj je veći" (ekran je to
   * prikazivao kao „200+"). Otkad `AuditLogService.find()` ima straničenje (dok. 39 nalaz 2.2),
   * broj dolazi iz `count` upita nad istim filterom, pa gornja granica više ne postoji —
   * `capped` je zato UKLONJEN, a ne ostavljen da zauvek stoji na `false`.
   */
  count: number;
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
        // Straničenje audit loga (6.9.2026, dok. 39 nalaz 2.2) donelo je ovde dve stvari:
        // (1) broj je sada TAČAN. Ranije se povlačilo do 200 redova pa se brojala dužina niza,
        //     pa je čvor sa 5.000 događaja pisao „200+" — što nije broj nego priznanje da se
        //     broj ne zna. `total` dolazi iz `count` upita nad istim filterom.
        // (2) povlači se JEDAN red umesto dvesta. Za čvor treba samo poslednje vreme; ostalih
        //     199 redova se nikad nije ni pogledalo, a mapa ih je dovlačila za svaki čvor
        //     posebno (`Promise.all` po definiciji mape).
        const { data, total } = await this.auditLog.find(
          { module: definition.module, actions: node.matchActions, from },
          { limit: 1 },
        );
        return {
          id: node.id,
          label: node.label,
          count: total,
          lastAt: data.length > 0 ? data[0].timestamp.toISOString() : null,
        };
      }),
    );

    return { key: definition.key, label: definition.label, nodes };
  }
}
