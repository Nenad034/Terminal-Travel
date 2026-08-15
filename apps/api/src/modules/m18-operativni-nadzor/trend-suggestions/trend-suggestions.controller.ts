import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrendSuggestionsService } from './trend-suggestions.service';
import { CreateTrendSuggestionDto } from './dto/create-trend-suggestion.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-trend-suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/trend-suggestions')
export class TrendSuggestionsController {
  constructor(private readonly trendSuggestions: TrendSuggestionsService) {}

  @Get()
  @RequirePermission('M18', 'trend-suggestion', 'VIEW')
  findAll() {
    return this.trendSuggestions.findAll();
  }

  @Post()
  @RequirePermission('M18', 'trend-suggestion', 'VIEW')
  create(@Body() dto: CreateTrendSuggestionDto) {
    return this.trendSuggestions.create(dto);
  }

  @Post(':id/approve')
  @RequirePermission('M18', 'trend-suggestion', 'APPROVE')
  approve(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.trendSuggestions.approve(id, actor.userId);
  }

  @Post(':id/reject')
  @RequirePermission('M18', 'trend-suggestion', 'APPROVE')
  reject(@Param('id') id: string) {
    return this.trendSuggestions.reject(id);
  }
}
