import RegisterTab from '@/components/RegisterTab';
import NewTicketForm from './NewTicketForm';

// M17 spec §4/§7 (Faza 5) — novi tiket, uvek requesterType=STAFF_ON_BEHALF (M14 spec §2.1) —
// vidi actions.ts createTicket.
export default function NoviTicketPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Novi tiket" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> podrska/tiketi/novi
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Unos tiketa u ime gosta/subagenta koji je zvao telefonom (M14 spec §2.1).</p>
      <NewTicketForm />
    </div>
  );
}
