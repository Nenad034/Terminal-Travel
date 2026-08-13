import { Module } from '@nestjs/common';
import { McpAdminModule } from './mcp-admin/mcp-admin.module';
import { McpServerModule } from './mcp-server/mcp-server.module';

// M16 spec — Agentski distribucioni interfejs (MCP). Izlaže deo M2/M5 API-ja eksternim
// AI agentima preko MCP protokola (poglavlje 1); nema sopstvenu bazu za poslovne podatke,
// samo MCPClientRegistration (poglavlje 3.1).
@Module({
  imports: [McpAdminModule, McpServerModule],
})
export class M16McpDistribucijaModule {}
