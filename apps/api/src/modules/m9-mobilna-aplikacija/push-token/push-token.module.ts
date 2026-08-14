import { Module } from '@nestjs/common';
import { PushTokenService } from './push-token.service';
import { PushTokenController } from './push-token.controller';
import { PushSenderService } from './push-sender.service';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthModule, EventBusModule],
  controllers: [PushTokenController],
  providers: [PushTokenService, PushSenderService],
  exports: [PushTokenService],
})
export class PushTokenModule {}
