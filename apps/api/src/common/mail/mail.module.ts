import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailerService } from './mailer.service';

/**
 * Slanje sistemske pošte treba na više mesta koja se međusobno ne poznaju (M1 pozivnica i
 * reset lozinke, M18 uzbune) — `@Global()` da svaki od njih ne mora da uvozi ovaj modul i
 * time pravi lanac zavisnosti između modula koji nemaju veze jedan sa drugim. Isti razlog
 * kao kod `EventBusService` (`common/events`) — infrastrukturni servis, ne poslovni modul.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailModule {}
