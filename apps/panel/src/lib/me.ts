import 'server-only';
import { cache } from 'react';
import { apiFetch } from './api-client';
import { getSession } from './session';

export interface EffectivePermission {
  module: string;
  resource: string;
  action: string;
}

export interface Me {
  userId: string;
  email: string;
  fullName: string;
  accountType: string;
  status: string;
  roles: string[];
  permissions: EffectivePermission[];
}

// M17 zadatak (avgust 2026) — GET /iam/auth/me je minimalna dopuna M1 otkrivena pri
// implementaciji panela (apps/api/src/modules/m1-core-identitet/auth/auth.controller.ts):
// vraća sopstveni profil + efektivnu listu dozvola trenutnog korisnika, uvek uživo nad
// bazom (M1 spec §3.6). `cache()` dedupuje poziv unutar istog request-a (layout + page
// oba zovu getMe() bez duplog HTTP poziva ka apps/api).
export const getMe = cache(async (): Promise<Me | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    return await apiFetch<Me>('/iam/auth/me');
  } catch {
    return null;
  }
});

export function hasPermission(me: Me | null, module: string, resource: string, action: string): boolean {
  if (!me) return false;
  return me.permissions.some((p) => p.module === module && p.resource === resource && p.action === action);
}
