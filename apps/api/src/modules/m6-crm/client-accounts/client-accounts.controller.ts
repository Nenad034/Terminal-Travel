import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientAccountsService } from './client-accounts.service';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateClientAccountDto } from './dto/update-client-account.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M6 spec §9, prefiks /api/v1/crm
@ApiTags('crm-client-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/client-accounts')
export class ClientAccountsController {
  constructor(private readonly clientAccounts: ClientAccountsService) {}

  @Get()
  @RequirePermission('M6', 'client-account', 'VIEW')
  findMany(@Query('email') email?: string, @Query('taxId') taxId?: string) {
    return this.clientAccounts.findMany({ email, taxId });
  }

  @Get(':id')
  @RequirePermission('M6', 'client-account', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.clientAccounts.findOne(id);
  }

  @Get(':id/travel-history')
  @RequirePermission('M6', 'client-account', 'VIEW')
  travelHistory(@Param('id') id: string) {
    return this.clientAccounts.travelHistory(id);
  }

  @Post()
  @RequirePermission('M6', 'client-account', 'CREATE')
  create(@Body() dto: CreateClientAccountDto) {
    return this.clientAccounts.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M6', 'client-account', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateClientAccountDto) {
    return this.clientAccounts.update(id, dto);
  }
}
