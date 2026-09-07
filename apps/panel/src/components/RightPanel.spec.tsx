import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingSummary } from './RightPanel';
import type { BookingRowSummary } from './RowSummaryContext';

// Nalaz 2.4b (dok. 39) — regresioni test za nalaz 1.1: dugme "Otvori pun zapis" je nekad vodilo
// na mrtvu mock rutu jer sažetak nosio samo broj rezervacije, ne interni ID. Ispravka je bila:
// dugme se prikazuje SAMO kad `bookingId` postoji; bez njega je odsutno dugme bolje od dugmeta
// koje otvori "nije pronađena". Ovaj test zaključava baš to ponašanje.
function makeSummary(overrides: Partial<BookingRowSummary> = {}): BookingRowSummary {
  return {
    kind: 'booking',
    bookingNumber: 'TT-000123',
    buyerName: 'Petar Petrović',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    stayFrom: '',
    stayTo: '',
    totalPrice: 50000,
    currency: 'EUR',
    ...overrides,
  };
}

describe('BookingSummary (dosije — sažetak reda)', () => {
  it('prikazuje dugme "Otvori pun zapis" i poziva callback kad sažetak nosi bookingId', async () => {
    const onOpen = jest.fn();
    render(
      <BookingSummary summary={makeSummary({ bookingId: 'abc-123' })} onOpenFullRecord={onOpen} />,
    );

    const button = screen.getByRole('button', { name: /otvori pun zapis/i });
    await userEvent.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('NE prikazuje dugme "Otvori pun zapis" kad sažetak nema bookingId (nalaz 1.1)', () => {
    render(<BookingSummary summary={makeSummary()} onOpenFullRecord={undefined} />);

    expect(screen.queryByRole('button', { name: /otvori pun zapis/i })).not.toBeInTheDocument();
  });

  it('prikazuje broj rezervacije i status', () => {
    render(
      <BookingSummary summary={makeSummary({ bookingNumber: 'TT-000999', status: 'PENDING' })} />,
    );

    expect(screen.getByText('TT-000999')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });
});
