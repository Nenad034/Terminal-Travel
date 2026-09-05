import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DestinationProfilesService } from './destination-profiles.service';
import { CreateDestinationProfileDto } from './dto/create-destination-profile.dto';
import { UpdateDestinationProfileDto } from './dto/update-destination-profile.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M2 spec §2.1c (dopuna 5.9.2026) — CRUD nad DestinationProfile (tip destinacije + aktivnosti).
// Interni kanal (M17) — ljudski unos/potvrda; AI-predlog-tok je van obima ovog prolaza (nema
// odluke o AI provajderu, isto ograničenje kao ProductContentImport §3.3).
@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog/destination-profiles')
export class DestinationProfilesController {
  constructor(private readonly destinationProfiles: DestinationProfilesService) {}

  @Get()
  @RequirePermission('M2', 'destination-profile', 'VIEW')
  findAll() {
    return this.destinationProfiles.findAll();
  }

  // Pojedinačan profil po destinaciji (par destinationCountry+destinationCity, §2.1c) — ne po
  // sopstvenom UUID-u u putanji, jer je pozivalac (M5 pretraga) po prirodi zna destinaciju.
  @Get('by-destination')
  @RequirePermission('M2', 'destination-profile', 'VIEW')
  findOne(@Query('destinationCountry') destinationCountry: string, @Query('destinationCity') destinationCity: string) {
    return this.destinationProfiles.findOne(destinationCountry, destinationCity);
  }

  @Post()
  @RequirePermission('M2', 'destination-profile', 'CREATE')
  create(@Body() dto: CreateDestinationProfileDto, @CurrentUser() actor: { userId: string }) {
    return this.destinationProfiles.create(dto, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M2', 'destination-profile', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateDestinationProfileDto, @CurrentUser() actor: { userId: string }) {
    return this.destinationProfiles.update(id, dto, actor.userId);
  }
}
