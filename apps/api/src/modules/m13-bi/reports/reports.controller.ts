import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService, DYNAMIC_DIMENSIONS, DynamicDimension, OCCUPANCY_GROUP_BY, OccupancyGroupBy } from './reports.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M13 spec §7, prefiks /api/v1/bi
@ApiTags('bi-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bi/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('profitability')
  @RequirePermission('M13', 'report:profitability', 'VIEW')
  profitability(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('destinationCountry') destinationCountry?: string,
    @Query('destinationCity') destinationCity?: string,
    @Query('supplierId') supplierId?: string,
    @Query('providerCode') providerCode?: string,
    @Query('channel') channel?: string,
  ) {
    return this.reports.profitability({ from, to, destinationCountry, destinationCity, supplierId, providerCode, channel });
  }

  @Get('sales')
  @RequirePermission('M13', 'report:sales', 'VIEW')
  sales(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('channel') channel?: string,
    @Query('productType') productType?: string,
  ) {
    return this.reports.sales({ from, to, channel, productType });
  }

  @Get('occupancy')
  @RequirePermission('M13', 'report:occupancy', 'VIEW')
  occupancy(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('destinationCountry') destinationCountry?: string,
    @Query('destinationCity') destinationCity?: string,
    @Query('supplierId') supplierId?: string,
    @Query('group_by') groupBy?: string,
  ) {
    if (groupBy && !OCCUPANCY_GROUP_BY.includes(groupBy as OccupancyGroupBy)) {
      throw new BadRequestException(`group_by mora biti jedno od: ${OCCUPANCY_GROUP_BY.join(', ')} (M13 spec §7).`);
    }
    return this.reports.occupancy({
      from,
      to,
      destinationCountry,
      destinationCity,
      supplierId,
      groupBy: groupBy as OccupancyGroupBy | undefined,
    });
  }

  @Get('dynamic')
  @RequirePermission('M13', 'report:dynamic', 'VIEW')
  dynamic(@Query('from') from?: string, @Query('to') to?: string, @Query('group_by') groupBy?: string) {
    const dims = (groupBy ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0) as DynamicDimension[];
    if (dims.length === 0) {
      throw new BadRequestException('group_by je obavezan — uređena, zarezom razdvojena lista dimenzija (M13 spec §7).');
    }
    const invalid = dims.filter((d) => !DYNAMIC_DIMENSIONS.includes(d));
    if (invalid.length > 0) {
      throw new BadRequestException(`Nepoznate dimenzije: ${invalid.join(', ')}. Dozvoljeno: ${DYNAMIC_DIMENSIONS.join(', ')} (M13 spec §4.2).`);
    }
    return this.reports.dynamic({ from, to }, dims);
  }

  @Get('marketing')
  @RequirePermission('M13', 'report:marketing', 'VIEW')
  marketing(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.marketing({ from, to });
  }
}
