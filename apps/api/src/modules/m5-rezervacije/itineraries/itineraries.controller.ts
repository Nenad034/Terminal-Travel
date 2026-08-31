import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §11, prefiks /api/v1/sales
@ApiTags('sales-itineraries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/itineraries')
export class ItinerariesController {
  constructor(private readonly itineraries: ItinerariesService) {}

  @Get()
  @RequirePermission('M5', 'itinerary', 'VIEW')
  findAll(@Query('clientAccountId') clientAccountId: string | undefined, @CurrentUser() actor: { userId: string }) {
    return this.itineraries.findAll(clientAccountId, actor.userId);
  }

  @Post()
  @RequirePermission('M5', 'itinerary', 'CREATE')
  create(@Body() dto: CreateItineraryDto, @CurrentUser() actor: { userId: string }) {
    return this.itineraries.create(dto, actor);
  }

  @Get(':id')
  @RequirePermission('M5', 'itinerary', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.itineraries.findOne(id, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M5', 'itinerary', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateItineraryDto, @CurrentUser() actor: { userId: string }) {
    return this.itineraries.update(id, dto, actor.userId);
  }

  @Post(':id/to-quote')
  @RequirePermission('M5', 'itinerary', 'EDIT')
  toQuote(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.itineraries.convertToQuote(id, actor);
  }
}
