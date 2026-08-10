import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenPayload {
  sub: string; // user_id — access token nosi SAMO user_id i session_id (M1 spec §3.7), ništa o pravima
  sessionId: string;
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
      const payload = this.jwt.verify<AccessTokenPayload>(token);
      request.user = { userId: payload.sub, sessionId: payload.sessionId };
      return true;
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao token');
    }
  }
}
