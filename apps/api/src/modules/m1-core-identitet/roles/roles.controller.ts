import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AddRolePermissionsDto } from './dto/add-role-permissions.dto';

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

  // M1 spec §6 (dopuna 4.9.2026) — dozvole po ulozi. Ista dozvola kao izmena uloge
  // (`M1/role/EDIT`): ko sme da menja ulogu, sme i da menja šta ta uloga može.
  @Get(':id/permissions')
  @RequirePermission('M1', 'role', 'VIEW')
  listPermissions(@Param('id') id: string) {
    return this.roles.listPermissions(id);
  }

  @Post(':id/permissions')
  @RequirePermission('M1', 'role', 'EDIT')
  addPermissions(
    @Param('id') id: string,
    @Body() dto: AddRolePermissionsDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.roles.addPermissions(id, dto.permissionIds, actor.userId);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermission('M1', 'role', 'EDIT')
  removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.roles.removePermission(id, permissionId, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M1', 'role', 'EDIT')
  update(@Param('id') id: string, @Body('description') description: string, @CurrentUser() actor: { userId: string }) {
    return this.roles.update(id, description, actor.userId);
  }
}
