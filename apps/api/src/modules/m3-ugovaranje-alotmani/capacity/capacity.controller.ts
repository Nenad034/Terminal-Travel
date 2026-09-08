import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CapacityService } from './capacity.service';
import { CapacityGridQueryDto } from './dto/capacity-grid-query.dto';
import { SetStopSaleDto } from './dto/set-stop-sale.dto';
import { SetCapacityOverrideDto } from './dto/set-capacity-override.dto';
import { CreateCapacityBlockDto } from './dto/create-capacity-block.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M3 spec §6 (dopuna v1.15) — mreža kapaciteta, stop-sale i blokade. Prefiks /api/v1/contracting.
@ApiTags('contracting-capacity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting/capacity')
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get('grid')
  @RequirePermission('M3', 'capacity', 'VIEW')
  grid(@Query() query: CapacityGridQueryDto) {
    return this.capacity.grid(query);
  }

  // Izmena ugovorenog kapaciteta namerno koristi POSTOJEĆU dozvolu (spec §5): to je izmena
  // ugovora, ne nova vrsta odgovornosti.
  @Put('days')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  setOverride(@Body() dto: SetCapacityOverrideDto, @CurrentUser() actor: { userId: string }) {
    return this.capacity.setCapacityOverride(dto, actor.userId);
  }

  @Post('stop-sale')
  @RequirePermission('M3', 'capacity', 'CLOSE_SALE')
  stopSale(@Body() dto: SetStopSaleDto, @CurrentUser() actor: { userId: string }) {
    return this.capacity.setStopSale(dto, actor.userId, false);
  }

  @Delete('stop-sale')
  @RequirePermission('M3', 'capacity', 'CLOSE_SALE')
  reopenSale(@Body() dto: SetStopSaleDto, @CurrentUser() actor: { userId: string }) {
    return this.capacity.setStopSale(dto, actor.userId, true);
  }

  @Get('blocks')
  @RequirePermission('M3', 'capacity', 'VIEW')
  listBlocks(@Query('contractPeriodId') contractPeriodId: string) {
    return this.capacity.listBlocks(contractPeriodId);
  }

  @Post('blocks')
  @RequirePermission('M3', 'capacity', 'BLOCK')
  createBlock(@Body() dto: CreateCapacityBlockDto, @CurrentUser() actor: { userId: string }) {
    return this.capacity.createBlock(dto, actor.userId);
  }

  @Patch('blocks/:blockId')
  @RequirePermission('M3', 'capacity', 'BLOCK')
  releaseBlock(
    @Param('blockId') blockId: string,
    @Body() body: { convertedBookingId?: string },
    @CurrentUser() actor: { userId: string },
  ) {
    return this.capacity.releaseBlock(blockId, actor.userId, body?.convertedBookingId);
  }
}
