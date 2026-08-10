import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M1 spec §6, prefiks /api/v1/iam
@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('M1', 'role', 'VIEW')
  findAll() {
    return this.roles.findAll();
  }

  @Post()
  @RequirePermission('M1', 'role', 'CREATE')
  create(
    @Body('name') name: string,
    @Body('description') description: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.roles.create(name, description, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M1', 'role', 'EDIT')
  update(@Param('id') id: string, @Body('description') description: string, @CurrentUser() actor: { userId: string }) {
    return this.roles.update(id, description, actor.userId);
  }
}
