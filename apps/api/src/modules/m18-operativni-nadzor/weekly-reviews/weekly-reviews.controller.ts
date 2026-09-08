import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeeklyReviewsService } from './weekly-reviews.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../../common/pagination/pagination';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-weekly-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/weekly-reviews')
export class WeeklyReviewsController {
  constructor(private readonly weeklyReviews: WeeklyReviewsService) {}

  @Get()
  @RequirePermission('M18', 'weekly-review', 'VIEW')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.weeklyReviews.findAll(parsePagination(page, limit));
  }

  @Post('run')
  @RequirePermission('M18', 'weekly-review', 'VIEW')
  run() {
    return this.weeklyReviews.run();
  }
}
