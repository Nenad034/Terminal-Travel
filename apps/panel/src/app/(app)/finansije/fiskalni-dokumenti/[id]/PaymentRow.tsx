'use client';

import { useState } from 'react';
import RecordPaymentForm, { BankOption } from './RecordPaymentForm';
import { Badge } from '@/components/ui/badge';

export interface PaymentRowData {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string | null;
  receivedAt?: string | null;
  createdAt?: string;
  bank?: { id: string; name: string } | null;
  checkDetails?: { id: string; bankId: string; amount: number; checkNumber: string; clearanceDate: string }[];
  editable?: boolean;
}

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika: "omogućiti korigovanje specifikacije...
// uplatu bilo koje vrste je moguće izmeniti samo pod uslovom da već nije kreiran račun i nije
// urađena fiskalizacija") — zajednički red uplate za oba mesta gde se uplate prikazuju (fiskalni
// dokument i rezervacija/Finansije tab). "izmeni" se prikazuje isključivo kad API vrati
// `editable: true` — servisna provera (CARD nikad, SUBMITTED/ISSUED fiskalni dokument blokira),
// ne UI odluka; klik prebacuje red u istu formu kao unos nove uplate, predpopunjenu.
export default function PaymentRow({
  payment,
  bookingId,
  currency,
  revalidatePath,
  banks,
  variant = 'compact',
}: {
  payment: PaymentRowData;
  bookingId: string;
  currency: string;
  revalidatePath: string;
  banks: BankOption[];
  variant?: 'compact' | 'detailed';
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="border-b border-border last:border-b-0">
        <RecordPaymentForm
          bookingId={bookingId}
          currency={currency}
          revalidatePath={revalidatePath}
          banks={banks}
          editPayment={{
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            reference: payment.reference ?? null,
            bankId: payment.bank?.id ?? null,
            checkDetails: payment.checkDetails?.map((c) => ({
              bankId: c.bankId,
              amount: c.amount,
              checkNumber: c.checkNumber,
              clearanceDate: c.clearanceDate,
            })),
          }}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  const checkCount = payment.checkDetails?.length ?? 0;
  const dateLabel = payment.receivedAt || payment.createdAt ? new Date(payment.receivedAt ?? payment.createdAt!).toLocaleDateString('sr-RS') : '';
  const money = `${(payment.amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${payment.currency}`;

  if (variant === 'detailed') {
    return (
      <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
        <div>
          <div className="text-ink">
            {payment.method}
            {payment.bank && ` · ${payment.bank.name}`}
            {checkCount > 0 && ` · ${checkCount} ${checkCount === 1 ? 'ček' : 'čeka'}`}
          </div>
          <div className="text-xs text-ink-faint">
            {dateLabel}
            {payment.reference ? ` · ${payment.reference}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-ink">{money}</span>
          <StatusBadge status={payment.status} />
          {checkCount > 0 && (
            <a href={`/finansije/uplate/${payment.id}`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
              specifikacija →
            </a>
          )}
          {payment.editable && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
              izmeni
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-2 text-sm last:border-b-0">
      <span className="text-ink">
        {money} · {payment.method}
        {payment.bank && ` · ${payment.bank.name}`}
        {checkCount > 0 && ` · ${checkCount} ${checkCount === 1 ? 'ček' : 'čeka'}`}
      </span>
      <span className="flex items-center gap-2 text-xs text-ink-faint">
        {dateLabel}
        <StatusBadge status={payment.status} />
        {checkCount > 0 && (
          <a href={`/finansije/uplate/${payment.id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            specifikacija →
          </a>
        )}
        {payment.editable && (
          <button type="button" onClick={() => setEditing(true)} className="text-accent hover:underline">
            izmeni
          </button>
        )}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (['ISSUED', 'RECEIVED', 'PAID', 'ACCEPTED'].includes(status)) return <Badge variant="ok">{status}</Badge>;
  if (['REJECTED', 'STORNIRANO', 'FAILED', 'VOIDED', 'EXPIRED'].includes(status)) return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
