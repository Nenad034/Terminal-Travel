import RegisterTab from '@/components/RegisterTab';
import NewTicketForm from './NewTicketForm';


// M17 spec §4/§7 (Faza 5) — novi tiket, uvek requesterType=STAFF_ON_BEHALF (M14 spec §2.1) —
// vidi actions.ts createTicket.
export default async function NoviTicketPage(props: { searchParams: Promise<{ bookingId?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="p-6">
      <RegisterTab label="Novi tiket" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Novi tiket</h1>
      <NewTicketForm defaultBookingId={searchParams.bookingId ?? ''} />
    </div>
  );
}
