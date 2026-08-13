import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpAuthService } from './mcp-auth.service';
import { McpRateLimiterService } from './mcp-rate-limiter.service';
import { McpToolsService } from './mcp-tools.service';
import { McpServerFactoryService } from './mcp-server.factory';
import { SearchModule } from '../../m5-rezervacije/search/search.module';
import { QuotesModule } from '../../m5-rezervacije/quotes/quotes.module';
import { BookingsModule } from '../../m5-rezervacije/bookings/bookings.module';

@Module({
  imports: [SearchModule, QuotesModule, BookingsModule],
  controllers: [McpController],
  providers: [McpAuthService, McpRateLimiterService, McpToolsService, McpServerFactoryService],
})
export class McpServerModule {}
