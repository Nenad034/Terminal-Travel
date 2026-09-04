import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenPayload {
  sub: string; // user_id — access token nosi SAMO user_id i session_id (M1 spec §3.7), ništa o pravima
  sessionId: string;
}

/**
 * M1 spec §5 (nalaz 4.9.2026, pri uvođenju `mfa_setup_pending` tokena) — isti JWT ključ
 * potpisuje TRI različite vrste tokena: pun access token (`{ sub, sessionId }`), privremeni
 * `mfa_pending` (posle lozinke, pre TOTP koda) i `mfa_setup_pending` (prvo podešavanje 2FA).
 * Do ovog nalaza nijedan proverivač nije gledao ČIJI je token nego samo da li je potpis
 * važeći — što znači da je `mfa_pending` token, izdat nekome ko još NIJE prošao drugi
 * faktor, radio kao pun pristupni token svuda u sistemu (2FA se time praktično zaobilazila).
 * Rupa je zatečena, ne uvedena novim tokenom. Fail-closed: prihvata se isključivo payload
 * koji IMA `sessionId` i NEMA `type` — svaka buduća vrsta tokena mora nositi `type` i
 * time automatski ostaje van pristupnih putanja.
 */
export function assertAccessTokenPayload(payload: AccessTokenPayload & { type?: string }): AccessTokenPayload {
  if (payload.type !== undefined || typeof payload.sessionId !== 'string' || !payload.sessionId) {
    throw new UnauthorizedException('Nevažeći ili istekao token');
  }
  return payload;
}

/**
 * Access token je kratkotrajan JWT (15 min), bez ijednog podatka o pravima —
 * prava se uvek proveravaju uživo u PermissionsGuard/PermissionsService.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Nedostaje Bearer token');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = assertAccessTokenPayload(this.jwt.verify<AccessTokenPayload>(token));
      request.user = { userId: payload.sub, sessionId: payload.sessionId };
      return true;
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao token');
    }
  }
}
