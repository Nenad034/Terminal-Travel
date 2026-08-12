import { Module } from '@nestjs/common';
import { ClientAccountsService } from './client-accounts.service';
import { ClientAccountsController } from './client-accounts.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [ClientAccountsController],
  providers: [ClientAccountsService],
  exports: [ClientAccountsService],
})
export class ClientAccountsModule {}
