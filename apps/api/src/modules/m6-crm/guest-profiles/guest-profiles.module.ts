import { Module } from '@nestjs/common';
import { GuestProfilesService } from './guest-profiles.service';
import { GuestProfilesController } from './guest-profiles.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [GuestProfilesController],
  providers: [GuestProfilesService],
  exports: [GuestProfilesService],
})
export class GuestProfilesModule {}
