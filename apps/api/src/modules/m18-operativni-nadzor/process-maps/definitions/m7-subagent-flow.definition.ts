import { ProcessMapDefinition } from './process-map.types';

// M18 spec §9a — četvrti registrovan ProcessMapDefinition (dopunjeno 29.8.2026, na zahtev
// vlasnika: "uradimo isto i za M6/M7" — M6 preskočen po vlasnikovoj odluci (CRM danas beleži
// samo ručnu izmenu nivoa lojalnosti, nema dovoljno bogat trag za smislenu mapu toka, vidi
// docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md M6 sekcija). M7 ima bogat, već postojeći trag —
// bez potrebe za dopunom audit loga, isti slučaj kao m10-money-flow. Dva prirodna pod-toka u
// istoj mapi: onboarding subagenta (registracija → odobrenje → izmene) i tok rabata na proviziju
// (kreiran → odobren → primenjen/odbijen).
export const M7_SUBAGENT_FLOW_PROCESS_MAP: ProcessMapDefinition = {
  key: 'm7-subagent-flow',
  label: 'M7 — tok subagenata',
  module: 'M7',
  nodes: [
    // `subagent.registered` (samostalna prijava) i `.child_registered` (roditelj registruje
    // pod-subagenta) predstavljaju isti poslovni trenutak — nov subagent u mreži — razlika je
    // samo ko je pokrenuo, isti princip kao supplier_obligation čvor u m10-money-flow.
    { id: 'subagent-registered', label: 'Subagent registrovan', matchActions: ['subagent.registered', 'subagent.child_registered'] },
    { id: 'subagent-approved', label: 'Subagent odobren', matchActions: ['subagent.approved'] },
    { id: 'subagent-updated', label: 'Subagent/provizija izmenjeni', matchActions: ['subagent.updated', 'subagent.child_commission_updated'] },
    { id: 'commission-ceiling-warning', label: 'Upozorenje: plafon provizije', matchActions: ['subagent.commission_ceiling_warning'] },
    { id: 'rebate-created', label: 'Rabat na proviziju kreiran', matchActions: ['commission_rebate.draft_created'] },
    { id: 'rebate-approved', label: 'Rabat odobren', matchActions: ['commission_rebate.approved'] },
    { id: 'rebate-applied', label: 'Rabat primenjen', matchActions: ['commission_rebate.applied'] },
    { id: 'rebate-rejected', label: 'Rabat odbijen', matchActions: ['commission_rebate.rejected'] },
  ],
};
