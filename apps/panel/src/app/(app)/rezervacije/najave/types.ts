// Izdvojeno iz actions.ts (5.9.2026) — `'use server'` fajl sme da izvozi ISKLJUČIVO async
// funkcije (Next.js 16 pravilo, https://nextjs.org/docs/messages/invalid-use-server-value);
// `emptyState` je obična konstanta, pa je njeno prisustvo u actions.ts rušilo modul u
// runtime-u ("A 'use server' file can only export async functions, found object"). Tip i
// konstanta žive ovde, van 'use server' granice; i actions.ts i ManifestsClient.tsx uvoze
// odavde, bez kružnog uvoza jedno iz drugog.
export interface FormState {
  error: string | null;
  notice: string | null;
}

export const emptyState: FormState = { error: null, notice: null };
