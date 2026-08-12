import { PrismaService } from '../../prisma/prisma.service';

/**
 * Deljena "ko poziva" provera — access token namerno ne nosi ništa o identitetu/
 * pravima osim user_id/session_id (M1 spec §3.7), pa se account_type i "sopstveni"
 * profil (User.linked_profile_id) učitavaju uživo po pozivu, isto kao RBAC provera
 * (M1 §3.6). Koriste ga svi moduli koji moraju da razlikuju "sopstveno" od "tuđe"
 * za Gost/B2B pozivaoce (M5 §6.2 dopuna, M6 §7 dopuna, avgust 2026).
 */
export interface CallerIdentity {
  accountType: string | null;
  /** User.linked_profile_id — za GUEST je to ClientAccount.id, za SUBAGENT_CONTACT (M7) Subagent.id. */
  ownProfileId: string | null;
}

export async function resolveCallerIdentity(prisma: PrismaService, userId: string): Promise<CallerIdentity> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return { accountType: user?.accountType ?? null, ownProfileId: user?.linkedProfileId ?? null };
}
