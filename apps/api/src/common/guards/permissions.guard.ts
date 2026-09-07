import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../../modules/m1-core-identitet/permissions/permissions.service';

/**
 * Sprovodi @RequirePermission uz PermissionsService.hasPermission — uvek uživo
 * nad bazom (M1 spec §3.6), nikad iz JWT payload-a.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // `getAllAndOverride` umesto `get(..., getHandler())` (7.9.2026, zatvara zamku 13.5):
    // ranije se metapodatak čitao ISKLJUČIVO sa metode, pa je `@RequirePermission` postavljen
    // iznad `@Controller(...)` bio tiho ignorisan — ograda je izgledala postavljeno, a
    // propuštala je sve. Fail-open u kodu napisanom baš da nešto zatvori. Sada dekorator na
    // klasi važi za sve njene metode, a dekorator na metodi ga nadjačava.
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true; // ruta bez @RequirePermission — samo JwtAuthGuard važi

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    if (!userId) throw new ForbiddenException();

    const allowed = await this.permissions.hasPermission(
      userId,
      required.module,
      required.resource,
      required.action,
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Nema dozvolu ${required.module}/${required.resource}/${required.action}`,
      );
    }
    return true;
  }
}
