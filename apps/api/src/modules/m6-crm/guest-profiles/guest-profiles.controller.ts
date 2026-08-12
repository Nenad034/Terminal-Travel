import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuestProfilesService } from './guest-profiles.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M6 spec §9, prefiks /api/v1/crm
@ApiTags('crm-guest-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/guest-profiles')
export class GuestProfilesController {
  constructor(private readonly guestProfiles: GuestProfilesService) {}

  @Get()
  @RequirePermission('M6', 'guest-profile', 'VIEW')
  findMany(@Query('linkedClientAccountId') linkedClientAccountId?: string) {
    return this.guestProfiles.findMany({ linkedClientAccountId });
  }

  @Get(':id')
  @RequirePermission('M6', 'guest-profile', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.guestProfiles.findOne(id);
  }

  @Get(':id/travel-history')
  @RequirePermission('M6', 'guest-profile', 'VIEW')
  travelHistory(@Param('id') id: string) {
    return this.guestProfiles.travelHistory(id);
  }

  @Post()
  @RequirePermission('M6', 'guest-profile', 'CREATE')
  create(@Body() dto: CreateGuestProfileDto) {
    return this.guestProfiles.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M6', 'guest-profile', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateGuestProfileDto) {
    return this.guestProfiles.update(id, dto);
  }
}
