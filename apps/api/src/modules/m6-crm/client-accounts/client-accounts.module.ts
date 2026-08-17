import { Module } from '@nestjs/common';
import { ClientAccountsService } from './client-accounts.service';
import { ClientAccountsController } from './client-accounts.controller';
import { GuestCheckoutService } from './guest-checkout.service';
import { GuestCheckoutController } from './guest-checkout.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  // AuthModule eksportuje AuthService — GuestCheckoutService ga koristi (M8 spec
  // poglavlje 3, korak 3 dopuna, avgust 2026), pored JwtAuthGuard-a koji je već
  // ovde bio potreban za ClientAccountsController.
  imports: [AuthModule, PermissionsModule],
  controllers: [ClientAccountsController, GuestCheckoutController],
  providers: [ClientAccountsService, GuestCheckoutService],
  exports: [ClientAccountsService],
})
export class ClientAccountsModule {}
