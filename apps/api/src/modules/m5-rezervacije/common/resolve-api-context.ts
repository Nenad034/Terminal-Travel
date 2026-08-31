import { PrismaService } from '../../../prisma/prisma.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { SubagentStubService } from './subagent-stub.service';

// M5 spec §6.2 — deljena rezolucija poziočevog konteksta (INTERNAL_PANEL vidi sve, B2C/B2B
// dobijaju maskiran prikaz i strogo ownership ponašanje). IZDVOJENO iz `BookingsService`
// (bezbednosni nalaz 28.8.2026, pre lansiranja pregled) — `QuotesService.findOne` je imao
// SOPSTVENU, nepotpunu proveru (samo GUEST, ne SUBAGENT_CONTACT/AI_AGENT) umesto da deli ovu
// logiku, i nikad nije maskirao odgovor — tačno vrsta greške koju deljena funkcija sprečava.
export type M5CallerContext = 'INTERNAL_PANEL' | 'B2C' | 'B2B';

export async function resolveApiContext(
  prisma: PrismaService,
  subagentStub: SubagentStubService,
  userId: string,
): Promise<{ context: M5CallerContext; ownClientAccountId: string | null; franchiseSubagentId: string | null }> {
  const identity = await resolveCallerIdentity(prisma, userId);
  if (identity.accountType === 'GUEST') return { context: 'B2C', ownClientAccountId: identity.ownProfileId, franchiseSubagentId: null };
  if (identity.accountType === 'SUBAGENT_CONTACT') {
    const clientAccountId = identity.ownProfileId
      ? await subagentStub.resolveClientAccountIdForSubagentContact(identity.ownProfileId)
      : null;
    return { context: 'B2B', ownClientAccountId: clientAccountId, franchiseSubagentId: null };
  }
  // M16 spec §2/§4 — MCP klijent (User.accountType=AI_AGENT) dobija isto B2C maskiranje kao
  // gost (sakriva supplier polja), ali sopstveni ClientAccount predstavlja CEO spoljnog
  // partnera, ne pojedinačnog putnika — User.linked_profile_id je već direktno ClientAccount.id.
  if (identity.accountType === 'AI_AGENT') return { context: 'B2C', ownClientAccountId: identity.ownProfileId, franchiseSubagentId: null };
  // M1 spec §3.1a / M7 spec §2.0.7 (31.8.2026) — STAFF nalog vezan (linked_profile_id) za
  // Subagent sa privilegeLevel=FRANCHISE dobija pun INTERNAL_PANEL kontekst, uz dodatnu
  // franšiznu granicu vidljivosti (M5 spec §6.6) primenjenu u pozivaocu (BookingsService).
  let franchiseSubagentId: string | null = null;
  if (identity.ownProfileId) {
    const subagent = await prisma.subagent.findUnique({ where: { id: identity.ownProfileId } });
    if (subagent && subagent.privilegeLevel === 'FRANCHISE') franchiseSubagentId = subagent.id;
  }
  return { context: 'INTERNAL_PANEL', ownClientAccountId: null, franchiseSubagentId };
}
