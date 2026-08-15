import { HelpAudience } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M21 spec §2.3/§5.2 — izvodi `audience_context` iz naloga koji pita, NIKAD iz onoga što
 * pozivalac pošalje u telu zahteva. STAFF/SUBAGENT idu direktno iz `User.account_type`;
 * BUSINESS_CLIENT zahteva GUEST nalog povezan (preko `User.linked_profile_id`, isti obrazac
 * kao `resolveCallerIdentity`) sa M6 `ClientAccount.account_type = LEGAL_ENTITY` — provera
 * UŽIVO nad bazom (poglavlje 3, "nikad iz keširanog/token podatka"), nikad keširana.
 *
 * `null` = nema pristup Centru za pomoć u v1 (pojedinačni/INDIVIDUAL GUEST, ili nalog bez
 * account_type koji ovde ima smisla, npr. AI_AGENT/SUPPLIER_CONTACT) — spec poglavlje 1/7.
 */
export async function resolveHelpAudience(prisma: PrismaService, userId: string): Promise<HelpAudience | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (user.accountType === 'STAFF') return 'STAFF';
  if (user.accountType === 'SUBAGENT_CONTACT') return 'SUBAGENT';

  if (user.accountType === 'GUEST') {
    if (!user.linkedProfileId) return null;
    const clientAccount = await prisma.clientAccount.findUnique({ where: { id: user.linkedProfileId } });
    if (clientAccount?.accountType === 'LEGAL_ENTITY') return 'BUSINESS_CLIENT';
    return null; // INDIVIDUAL — namerno van obima v1 (spec poglavlje 1)
  }

  return null;
}

/** Mapira HelpAudience na segment korišćen u permission resource ključu `article:<segment>`. */
export function audienceToPermissionSegment(audience: HelpAudience): 'staff' | 'subagent' | 'business' {
  if (audience === 'STAFF') return 'staff';
  if (audience === 'SUBAGENT') return 'subagent';
  return 'business';
}
