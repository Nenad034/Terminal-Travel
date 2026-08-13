import { Module } from '@nestjs/common';
import { M12EventSubscribersService } from './m12-event-subscribers.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { ContentModule } from '../content/content.module';
import { ProductsModule } from '../../m2-katalog-proizvoda/products/products.module';

@Module({
  imports: [EventBusModule, ContentModule, ProductsModule],
  providers: [M12EventSubscribersService],
})
export class M12EventsModule {}
