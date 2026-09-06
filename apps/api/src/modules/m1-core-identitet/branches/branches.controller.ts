import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M1 spec dopuna (6.9.2026), prefiks /api/v1/iam — globalno podešavanje poslovnica.
@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  // Bez @RequirePermission na GET — svaki STAFF nalog treba da vidi listu poslovnica
  // (npr. da bi izabrao svoju pri izmeni sopstvenog profila), samo CREATE/EDIT su ograničeni.
  @Get()
  findAll() {
    return this.branches.findAll();
  }

  @Post()
  @RequirePermission('M1', 'branch', 'CREATE')
  create(@Body('name') name: string, @CurrentUser() actor: { userId: string }) {
    return this.branches.create(name, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M1', 'branch', 'EDIT')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; active?: boolean },
    @CurrentUser() actor: { userId: string },
  ) {
    return this.branches.update(id, dto, actor.userId);
  }
}
