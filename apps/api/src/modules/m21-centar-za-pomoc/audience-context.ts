import { HelpAudience } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M21 spec §2.3/§5.2 — izvodi `audience_context` iz naloga koji pita, NIKAD iz onoga što
 * pozivalac pošalje u telu zahteva. STAFF/SUBAGENT idu direktno iz `User.account_type`;
 * BUSINESS_CLIENT zahteva GUEST nalog povezan (preko `User.linked_profile_id`, isti obrazac
 * kao `resolveCallerIdentity`) sa M6 `ClientAccount.account_type = LEGAL_ENTITY` — provera
 * UŽIVO nad bazom (poglavlje 3, "nikad iz keširanog/token podatka"), nikad keširana.
 *
 * `userId = null` = potpuno anoniman B2C posetilac (nema User zapis uopšte) — vraća
 * PUBLIC_GUEST odmah, bez ijednog upita nad bazom (avgust 2026, vlasnikova odluka, M15 spec
 * §11 "B2C_SITE omnisearch dopuna").
 *
 * `null` povratna vrednost i dalje postoji za naloge koji ovde nemaju smisla (npr. AI_AGENT/
 * SUPPLIER_CONTACT) — ti nemaju pristup Centru za pomoć ni kao PUBLIC_GUEST.
 */
export async function resolveHelpAudience(prisma: PrismaService, userId: string | null): Promise<HelpAudience | null> {
  if (userId === null) return 'PUBLIC_GUEST';

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (user.accountType === 'STAFF') return 'STAFF';
  if (user.accountType === 'SUBAGENT_CONTACT') return 'SUBAGENT';

  if (user.accountType === 'GUEST') {
    if (!user.linkedProfileId) return 'PUBLIC_GUEST'; // bez povezanog ClientAccount — tretira se kao pojedinačni gost
    const clientAccount = await prisma.clientAccount.findUnique({ where: { id: user.linkedProfileId } });
    if (clientAccount?.accountType === 'LEGAL_ENTITY') return 'BUSINESS_CLIENT';
    return 'PUBLIC_GUEST'; // INDIVIDUAL (avgust 2026) — sopstvena, uža publika umesto potpunog isključenja
  }

  return null;
}

/** Mapira HelpAudience na segment korišćen u permission resource ključu `article:<segment>`. */
export function audienceToPermissionSegment(audience: HelpAudience): 'staff' | 'subagent' | 'business' | 'public' {
  if (audience === 'STAFF') return 'staff';
  if (audience === 'SUBAGENT') return 'subagent';
  if (audience === 'BUSINESS_CLIENT') return 'business';
  return 'public';
}
