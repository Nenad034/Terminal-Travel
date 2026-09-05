import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewSupplierConversationForm from './NewSupplierConversationForm';
import SupplierConversationRow from './SupplierConversationRow';


interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'EXTERNAL_SUPPLIER';
  supplierId: string | null;
  createdAt: string;
  lastMessage: { id: string; senderId: string; body: string | null; sentAt: string } | null;
}

interface ConversationDetail {
  id: string;
  participants: { userId: string; user: { id: string; fullName: string; accountType: string } | null }[];
}

interface AccessEntry {
  id: string;
  conversationId: string;
  userId: string;
  grantedAt: string;
}

interface SupplierContactRow {
  id: string;
  fullName: string;
  email: string;
  linkedUserId: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

// M17 spec §4/§7 (Faza 7), M19 spec §9 — razgovori sa dobavljačima (EXTERNAL_SUPPLIER, uža
// ograda od internog tim-chata, §9.1). Prikaz + upravljanje SupplierConversationAccess (§9.4,
// "dodeli pristup") + pokretanje portal naloga kontakt-osobe (§9.2/§9.7, "pozovi kontakt") —
// oba dejstva gejtovana server-side po hasPermission(), potpuno sakrivena bez dozvole (§ "hide,
// not disable" princip iz svih dosadašnjih M17 ekrana).
export default async function SupplierChatPage() {
  const me = await getMe();
  const canGrant = hasPermission(me, 'M19', 'supplier-conversation', 'GRANT_ACCESS');
  const canViewSuppliers = hasPermission(me, 'M3', 'supplier', 'VIEW');
  const canViewContacts = hasPermission(me, 'M3', 'supplier-contact', 'VIEW');

  let conversations: ConversationSummary[] = [];
  let error: string | null = null;
  try {
    const all = await apiFetch<ConversationSummary[]>('/chat/conversations');
    conversations = all.filter((c) => c.type === 'EXTERNAL_SUPPLIER');
  } catch {
    error = 'Nemate pristup razgovorima sa dobavljačima (M19/supplier-conversation/VIEW ili nemate dodeljen pristup nijednom razgovoru).';
  }

  const supplierNames = new Map<string, string>();
  if (canViewSuppliers) {
    for (const c of conversations) {
      if (!c.supplierId || supplierNames.has(c.supplierId)) continue;
      try {
        const supplier = await apiFetch<Supplier>(`/contracting/suppliers/${c.supplierId}`);
        supplierNames.set(c.supplierId, supplier.name);
      } catch {
        // ostaje prikazano po sirovom ID-u ispod
      }
    }
  }

  const details = new Map<string, ConversationDetail>();
  const accessByConversation = new Map<string, AccessEntry[]>();
  const contactsBySupplier = new Map<string, SupplierContactRow[]>();

  for (const c of conversations) {
    try {
      details.set(c.id, await apiFetch<ConversationDetail>(`/chat/conversations/${c.id}`));
    } catch {
      // best-effort
    }
    if (canGrant) {
      try {
        accessByConversation.set(c.id, await apiFetch<AccessEntry[]>(`/chat/supplier-conversations/${c.id}/access`));
      } catch {
        accessByConversation.set(c.id, []);
      }
      if (canViewContacts && c.supplierId && !contactsBySupplier.has(c.supplierId)) {
        try {
          contactsBySupplier.set(c.supplierId, await apiFetch<SupplierContactRow[]>(`/contracting/suppliers/${c.supplierId}/contacts`));
        } catch {
          contactsBySupplier.set(c.supplierId, []);
        }
      }
    }
  }

  let suppliersForNewConversation: Supplier[] = [];
  if (canGrant && canViewSuppliers) {
    try {
      suppliersForNewConversation = await apiFetch<Supplier[]>('/contracting/suppliers');
    } catch {
      // forma za novi razgovor se jednostavno ne prikazuje ispod
    }
  }

  return (
    <div className="p-6">
      <RegisterTab label="Razgovori sa dobavljačima" />
      <Link href="/chat" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na razgovore tima
      </Link>

      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Razgovori sa dobavljačima</h1>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && canGrant && suppliersForNewConversation.length > 0 && (
        <div className="mb-4">
          <NewSupplierConversationForm suppliers={suppliersForNewConversation} />
        </div>
      )}

      {!error && (
        <div className="flex flex-col gap-3">
          {conversations.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema razgovora sa dobavljačima.</p>}
          {conversations.map((c) => (
            <SupplierConversationRow
              key={c.id}
              conversation={c}
              supplierName={c.supplierId ? (supplierNames.get(c.supplierId) ?? c.supplierId) : '—'}
              detail={details.get(c.id) ?? null}
              access={accessByConversation.get(c.id) ?? []}
              contacts={c.supplierId ? (contactsBySupplier.get(c.supplierId) ?? []) : []}
              canGrant={canGrant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
