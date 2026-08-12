import { Module } from '@nestjs/common';
import { ClientContractsModule } from './client-contracts/client-contracts.module';
import { M20EventsModule } from './events/m20-events.module';

// docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md
@Module({
  imports: [ClientContractsModule, M20EventsModule],
  exports: [ClientContractsModule],
})
export class M20UgovoriKlijentiModule {}
