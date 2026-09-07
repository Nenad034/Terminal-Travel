import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Nalaz 3.1 (dok. 39) — globalni JwtAuthGuard (app.module.ts) zaključava SVAKI endpoint
 * podrazumevano; ovaj dekorator je jedini način da se jedan konkretno otvori. Smer greške
 * se time okreće: zaboravljen dekorator znači "zaključano", ne "otvoreno".
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
