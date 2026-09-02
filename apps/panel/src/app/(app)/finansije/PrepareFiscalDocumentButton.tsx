'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { prepareFiscalDocument, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M10 spec §6 korak 1 — priprema nacrta, "Autonomno"/nulti rizik, ali i dalje deliberatan klik
// (ne automatski poziv pri učitavanju stranice rezervacije) — vodi na detalj gde se šalje (§6
// korak 2, isključivo ljudska radnja). Idempotentno na API strani: ako nacrt/dokument za ovu
// rezervaciju već postoji, vraća baš njega umesto da pravi duplikat.
/**
 * `quiet` (2.9.2026, na zahtev vlasnika: "ovo zaokruženo nema razloga da bude ovoliko
 * naglašeno") — tiha varijanta za karticu **Pregled**, gde ovo NIJE glavna radnja ekrana.
 *
 * Pregled je po definiciji sažetak koji se samo čita (M5 spec §4.5: "ovde se ništa ne menja,
 * samo se prikazuje"). Puno akcentno dugme preko cele širine bilo je najglasniji element na
 * ekranu — glasnije od iznosa u sažetku, koji jesu razlog zbog kog se ekran otvara. Akcentna
 * boja je po §2 rezervisana za GLAVNU radnju; kad je dobije uzgredna, prestaje da znači išta.
 *
 * Na kartici **Finansije** dugme ostaje puno i istaknuto — tamo jeste glavna radnja, pa se
 * podrazumevano ponašanje ne menja. Ista komponenta, dve težine po kontekstu.
 */
export default function PrepareFiscalDocumentButton({ bookingId, quiet }: { bookingId: string; quiet?: boolean }) {
  const boundAction = prepareFiscalDocument.bind(null, bookingId);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    // `items-end` u tihoj varijanti: bez njega `flex-col` rasteže dugme na punu širinu
    // (podrazumevano `align-items: stretch`) — to je i bio pravi razlog zašto je izgledalo kao
    // traka preko celog panela, ne samo boja.
    <form action={formAction} className={`flex flex-col gap-1 ${quiet ? 'items-end' : ''}`}>
      <SubmitButton quiet={quiet} />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton({ quiet }: { quiet?: boolean }) {
  const { pending } = useFormStatus();
  const label = pending ? 'Pripremam…' : quiet ? 'Fiskalni dokument →' : 'Pripremi/prikaži fiskalni dokument';
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      variant={quiet ? 'ghost' : 'default'}
      // `accent-strong`, ne `accent` — tiho dugme dobija `panel-2` kao podlogu na hover, gde
      // `accent` pada ispod AA praga (tvrdo pravilo §2a).
      className={quiet ? 'h-auto px-1.5 py-0.5 text-[11px] font-normal text-accent-strong hover:underline' : undefined}
    >
      {label}
    </Button>
  );
}
