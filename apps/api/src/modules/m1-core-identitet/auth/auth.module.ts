import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSharedModule } from '../../../common/auth-shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthSharedModule, AuditLogModule, EventBusModule],
  controllers: [AuthController],
  providers: [AuthService],
  // AuthSharedModule se re-eksportuje da moduli koji importuju AuthModule (za AuthService)
  // dobiju i JwtAuthGuard bez dodatnog importa — sprečava tačno ovakvu grešku.
  exports: [AuthService, AuthSharedModule],
})
export class AuthModule {}
