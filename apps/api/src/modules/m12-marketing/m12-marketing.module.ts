import { Module } from '@nestjs/common';
import { ContentModule } from './content/content.module';
import { ChannelsModule } from './channels/channels.module';
import { DistributionModule } from './distribution/distribution.module';
import { M12EventsModule } from './events/m12-events.module';

// docs/moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md
@Module({
  imports: [ContentModule, ChannelsModule, DistributionModule, M12EventsModule],
  exports: [ContentModule, ChannelsModule],
})
export class M12MarketingModule {}
