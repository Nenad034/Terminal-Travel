import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientContractsService } from './client-contracts.service';
import { ListClientContractsDto } from './dto/list-client-contracts.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M20 spec §6, prefiks /api/v1/client-contracts
@ApiTags('client-contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('client-contracts')
export class ClientContractsController {
  constructor(private readonly clientContracts: ClientContractsService) {}

  @Get()
  @RequirePermission('M20', 'client-contract', 'VIEW')
  findMany(@Query() query: ListClientContractsDto, @CurrentUser() actor: { userId: string }) {
    return this.clientContracts.findMany(query, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M20', 'client-contract', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.clientContracts.findOne(id, actor.userId);
  }

  @Post(':id/accept')
  @RequirePermission('M20', 'client-contract', 'ACCEPT')
  accept(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.clientContracts.accept(id, actor);
  }

  @Post(':id/void')
  @RequirePermission('M20', 'client-contract', 'VOID')
  void(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.clientContracts.void(id, actor);
  }
}
