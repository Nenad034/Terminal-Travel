'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createQuoteFromOffer, CreateQuoteState } from './actions';

const initialState: CreateQuoteState = { error: null };

export default function QuoteButton(props: {
  productId: string;
  rateLineId?: string;
  providerQuoteReference?: string;
  stayFrom?: string;
  stayTo?: string;
  adults: number;
  children: number;
}) {
  const [state, formAction] = useFormState(createQuoteFromOffer, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="productId" value={props.productId} />
      <input type="hidden" name="rateLineId" value={props.rateLineId ?? ''} />
      <input type="hidden" name="providerQuoteReference" value={props.providerQuoteReference ?? ''} />
      <input type="hidden" name="stayFrom" value={props.stayFrom ?? ''} />
      <input type="hidden" name="stayTo" value={props.stayTo ?? ''} />
      <input type="hidden" name="adults" value={props.adults} />
      <input type="hidden" name="children" value={props.children} />
      <SubmitButton />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? '…' : 'kreiraj ponudu'}
    </button>
  );
}
