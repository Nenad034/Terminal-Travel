import { ProcessMapDefinition } from './process-map.types';

// M18 spec §9a — treći registrovan ProcessMapDefinition (dopunjeno 29.8.2026, na zahtev
// vlasnika: "proširimo mapu i na M10" — tok novca: uplata gosta → faktura → obaveza
// dobavljaču → isplata, sa povraćajem kao zatvaranje petlje. Svi čvorovi prate akcije koje
// M10 već stvarno upisuje u audit log (fiscal-documents/payments/supplier-obligations/
// supplier-payments servisi) — bez dopune audit traga, isti princip kao m5-booking-flow.
export const M10_MONEY_FLOW_PROCESS_MAP: ProcessMapDefinition = {
  key: 'm10-money-flow',
  label: 'M10 — tok novca',
  module: 'M10',
  nodes: [
    { id: 'payment-recorded', label: 'Uplata gosta zabeležena', matchActions: ['payment.recorded'] },
    { id: 'invoice-created', label: 'Faktura kreirana', matchActions: ['fiscal_document.draft_created'] },
    { id: 'invoice-storno', label: 'Faktura stornirana', matchActions: ['fiscal_document.storno'] },
    // `supplier_obligation.created` (ručni unos) i `.auto_created` (iz M3 payment_schedule
    // rate ili M10 uvoza fakture dobavljača) predstavljaju isti poslovni trenutak — nastanak
    // obaveze — razlika je samo u tome ko/šta ju je pokrenulo, ne u čvoru na mapi.
    { id: 'supplier-obligation-created', label: 'Obaveza dobavljaču kreirana', matchActions: ['supplier_obligation.created', 'supplier_obligation.auto_created'] },
    { id: 'supplier-obligation-paid', label: 'Obaveza dobavljaču isplaćena', matchActions: ['supplier_obligation.paid'] },
    { id: 'refund-executed', label: 'Povraćaj gostu izvršen', matchActions: ['refund_instruction.executed'] },
  ],
};
