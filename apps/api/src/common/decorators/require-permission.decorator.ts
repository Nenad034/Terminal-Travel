import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: string;
  resource: string;
  action: string;
}

/**
 * M1 spec §3.3 — dozvola je (module, resource, action) trojka, npr. ('M1', 'audit-log', 'VIEW').
 * `action` je namerno slobodan string, ne strogi enum (svaki modul uvodi sopstvene akcije).
 */
export const RequirePermission = (module: string, resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { module, resource, action } as RequiredPermission);
