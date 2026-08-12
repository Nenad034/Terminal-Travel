import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoyaltyTiersService } from './loyalty-tiers.service';
import { ClientLoyaltyStatusService } from './client-loyalty-status.service';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';
import { OverrideLoyaltyStatusDto } from './dto/override-loyalty-status.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M6 spec §9, prefiks /api/v1/crm
@ApiTags('crm-loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm')
export class LoyaltyController {
  constructor(
    private readonly tiers: LoyaltyTiersService,
    private readonly status: ClientLoyaltyStatusService,
  ) {}

  @Get('loyalty-tiers')
  @RequirePermission('M6', 'loyalty-tier', 'VIEW')
  findTiers() {
    return this.tiers.findMany();
  }

  @Post('loyalty-tiers')
  @RequirePermission('M6', 'loyalty-tier', 'EDIT')
  createTier(@Body() dto: CreateLoyaltyTierDto) {
    return this.tiers.create(dto);
  }

  @Patch('loyalty-tiers/:id')
  @RequirePermission('M6', 'loyalty-tier', 'EDIT')
  updateTier(@Param('id') id: string, @Body() dto: UpdateLoyaltyTierDto) {
    return this.tiers.update(id, dto);
  }

  @Get('loyalty-status/:clientAccountId')
  @RequirePermission('M6', 'loyalty-tier', 'VIEW')
  getStatus(@Param('clientAccountId') clientAccountId: string) {
    return this.status.get(clientAccountId);
  }

  @Post('loyalty-status/:clientAccountId/override')
  @RequirePermission('M6', 'loyalty-status', 'OVERRIDE')
  override(
    @Param('clientAccountId') clientAccountId: string,
    @Body() dto: OverrideLoyaltyStatusDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.status.override(clientAccountId, dto.tierId, dto.reason, actor);
  }
}
