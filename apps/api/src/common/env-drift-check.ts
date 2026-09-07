import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Nalaz 4.4 (dok. 39) — `.env` i `.env.example` su se već jednom razišli bez ijedne provere:
 * `.env` je zaostao za 8 promenljivih, pa su pozivnice i reset lozinke TIHO prestali da rade
 * (4.9.2026). Provera je namerno upozorenje, ne rušenje — ne sme da spreči pokretanje servera
 * kome nedostaje samo neka opciona/buduća promenljiva, samo da to učini VIDLJIVIM na startu.
 *
 * Čita fajlove direktno (ne `process.env`) da ne zavisi od toga da li je `ConfigModule`
 * dotenv već popunio `process.env` u trenutku poziva.
 */
function parseEnvKeys(path: string): Set<string> {
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return new Set();
  }
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    if (match) keys.add(match[1]);
  }
  return keys;
}

export function checkEnvDrift(cwd: string = process.cwd()): void {
  const exampleKeys = parseEnvKeys(join(cwd, '.env.example'));
  if (exampleKeys.size === 0) return; // nema .env.example — ništa za poređenje

  const actualKeys = parseEnvKeys(join(cwd, '.env'));
  const missing = [...exampleKeys].filter((key) => !actualKeys.has(key)).sort();

  if (missing.length > 0) {
    console.warn(
      `[env-drift] .env nedostaje ${missing.length} promenljivih iz .env.example: ${missing.join(', ')}. ` +
        `Funkcije koje na njih računaju mogu tiho ne raditi (dok. 39, nalaz 4.4).`,
    );
  }
}
