// M5 spec §6.4 — provera duplikata pre otkazivanja: "determinisitčki fuzzy-match (normalizacija
// dijakritika/velikih-malih slova + prag sličnosti niske cene računanja, npr. Levenshtein), ne
// AI/LLM poziv po stavci" (princip #4 Master dokumenta — determinizam pre autonomije).

// Normalizacija: mala slova + uklanjanje dijakritika (č/ć/š/đ/ž i sl.) + trim razmaka.
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // ukloni dijakritičke znakove posle NFD dekompozicije
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, ' ');
}

// Standardan Levenshtein — broj izmena karaktera (ubaci/obriši/zameni) da se jedan string
// pretvori u drugi. O(n*m), dovoljno brzo za poređenje imena/prezimena (kratki stringovi).
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// Prag sličnosti — udeo (0..1) izmenjenih karaktera u odnosu na dužinu dužeg stringa.
// 1 = identično, 0 = potpuno različito.
export function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}

// M5 spec §6.4 — "podudarno ime gosta preko BookingItemGuest → M6 GuestProfile.first_name/last_name".
// Podrazumevani prag 0.85 (85% sličnosti karaktera) — dovoljno tolerantan za tipfelere/dijakritike,
// dovoljno strog da ne poklapa različita imena.
export const DEFAULT_NAME_SIMILARITY_THRESHOLD = 0.85;

export function namesMatch(
  firstNameA: string,
  lastNameA: string,
  firstNameB: string,
  lastNameB: string,
  threshold: number = DEFAULT_NAME_SIMILARITY_THRESHOLD,
): boolean {
  return similarity(firstNameA, firstNameB) >= threshold && similarity(lastNameA, lastNameB) >= threshold;
}
