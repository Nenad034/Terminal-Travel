import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { McpAdminService } from './mcp-admin.service';
import { CreateMcpClientDto } from './dto/create-mcp-client.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M16 spec §8, interni administrativni deo (van samog MCP protokola).
@ApiTags('mcp-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mcp-admin/clients')
export class McpAdminController {
  constructor(private readonly mcpAdmin: McpAdminService) {}

  @Get()
  @RequirePermission('M16', 'mcp-client', 'VIEW')
  findAll() {
    return this.mcpAdmin.findAll();
  }

  @Get(':id')
  @RequirePermission('M16', 'mcp-client', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.mcpAdmin.findOne(id);
  }

  @Post()
  @RequirePermission('M16', 'mcp-client', 'MANAGE')
  create(@Body() dto: CreateMcpClientDto, @CurrentUser() actor: { userId: string }) {
    return this.mcpAdmin.create(dto, actor.userId);
  }

  @Post(':id/activate')
  @RequirePermission('M16', 'mcp-client', 'MANAGE')
  activate(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.mcpAdmin.activate(id, actor.userId);
  }

  // M16 spec §3.1/§7 — jedini put do READ_WRITE, odvojena dozvola od MANAGE (nikad automatski).
  @Post(':id/approve-read-write')
  @RequirePermission('M16', 'mcp-client', 'APPROVE_READ_WRITE')
  approveReadWrite(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.mcpAdmin.approveReadWrite(id, actor.userId);
  }

  @Post(':id/suspend')
  @RequirePermission('M16', 'mcp-client', 'MANAGE')
  suspend(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.mcpAdmin.suspend(id, actor.userId);
  }
}
