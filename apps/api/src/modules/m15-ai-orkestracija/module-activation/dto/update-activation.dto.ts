import { IsIn } from 'class-validator';

// M15 spec §3, §9 — PATCH /ai-orchestration/modules/:code/activation. Ljudska odluka je
// isključivo prelazak u ACTIVATED (ili nazad u NOT_READY/READY_FOR_ACTIVATION po potrebi) —
// tests_passing/production_cycle_completed su informativni checkbox-evi koje sme da postavi
// isti krug ljudi, ne odvojen API.
export class UpdateActivationDto {
  @IsIn(['NOT_READY', 'READY_FOR_ACTIVATION', 'ACTIVATED'])
  status!: 'NOT_READY' | 'READY_FOR_ACTIVATION' | 'ACTIVATED';
}
