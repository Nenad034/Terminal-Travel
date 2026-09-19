import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TablesService } from './tables.service';
import { ExportTableDto, RunTableDto } from './dto/run-table.dto';
import { TABLE_SOURCES } from './table-sources';

// M15 spec §6.5.4.10 / M17 §6e — Terminal tabela. BEZ statične @RequirePermission: dozvola
// zavisi od `spec.source` (i od `dimension` za funnel), proverava se programski u servisu —
// isti obrazac kao M13 `/reports/export` (§7 te specifikacije). JwtAuthGuard i dalje važi.
@ApiTags('M15 — Terminal tabela')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-orchestration/tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  /** Registar izvora za ekran „Nova tabela" (bez AI-ja) — labela, filteri, kolone. */
  @Get('sources')
  sources() {
    return Object.values(TABLE_SOURCES).map((s) => ({
      id: s.id,
      label: s.label,
      filters: s.filters,
      columns: s.columns,
      hasPeriod: s.periodFilter !== null,
    }));
  }

  @Post('run')
  run(@Body() dto: RunTableDto, @CurrentUser() user: { userId: string }) {
    return this.tables.run(dto.spec, user.userId);
  }

  @Post('export')
  export(@Body() dto: ExportTableDto, @CurrentUser() user: { userId: string }) {
    return this.tables.export(dto.spec, dto.format, dto.transform, user.userId, dto.scenarioLabel);
  }
}
