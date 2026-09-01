import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserPreferencesService } from './user-preferences.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatePermissionOverrideDto } from './dto/create-permission-override.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M1 spec §6, prefiks /api/v1/iam
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam/users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly preferences: UserPreferencesService,
  ) {}

  // M1 spec §3.9/§6 — lična podešavanja, bez RBAC iznad "sopstveni nalog" (userId iz JWT-a, ne
  // iz rute). `:id` ruta ispod ne kolidira (dva segmenta "me/preferences" naspram jednog
  // dinamičkog), ali ostaje deklarisano na vrhu radi čitljivosti.
  @Get('me/preferences')
  getMyPreferences(@CurrentUser() actor: { userId: string }) {
    return this.preferences.findAll(actor.userId);
  }

  @Put('me/preferences/:key')
  setMyPreference(@Param('key') key: string, @Body('value') value: unknown, @CurrentUser() actor: { userId: string }) {
    return this.preferences.set(actor.userId, key, value);
  }

  @Get()
  @RequirePermission('M1', 'user', 'VIEW')
  findAll() {
    return this.users.findAll();
  }

  // Dopuna (31.8.2026) — mora biti registrovano PRE `:id` (isti obrazac/lekcija kao M3
  // spec, literalna ruta ispred parametarske rute istog broja segmenata). Bez
  // @RequirePermission namerno — dostupno svakom STAFF nalogu, provera je u servisu.
  @Get('directory')
  directory(@CurrentUser() actor: { userId: string }, @Query('role') role?: string) {
    return this.users.directory(actor.userId, role);
  }

  @Post()
  @RequirePermission('M1', 'user', 'CREATE')
  invite(@Body() dto: CreateUserDto, @CurrentUser() actor: { userId: string }) {
    return this.users.invite(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M1', 'user', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('M1', 'user', 'EDIT')
  update(
    @Param('id') id: string,
    @Body() dto: { fullName?: string; phone?: string },
    @CurrentUser() actor: { userId: string },
  ) {
    return this.users.update(id, dto, actor.userId);
  }

  // DELETE = meko gašenje (M1 spec §6), ne fizičko brisanje.
  @Delete(':id')
  @RequirePermission('M1', 'user', 'DELETE')
  suspend(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.users.suspend(id, actor.userId);
  }

  @Post(':id/roles')
  @RequirePermission('M1', 'user', 'EDIT')
  assignRole(@Param('id') id: string, @Body('roleId') roleId: string, @CurrentUser() actor: { userId: string }) {
    return this.users.assignRole(id, roleId, actor.userId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('M1', 'user', 'EDIT')
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string, @CurrentUser() actor: { userId: string }) {
    return this.users.removeRole(id, roleId, actor.userId);
  }

  @Get(':id/permission-overrides')
  @RequirePermission('M1', 'permission-override', 'VIEW')
  listOverrides(@Param('id') id: string) {
    return this.users.listPermissionOverrides(id);
  }

  @Post(':id/permission-overrides')
  @RequirePermission('M1', 'permission-override', 'CREATE')
  createOverride(
    @Param('id') id: string,
    @Body() dto: CreatePermissionOverrideDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.users.createPermissionOverride(id, dto, actor.userId);
  }

  @Delete('permission-overrides/:overrideId')
  @RequirePermission('M1', 'permission-override', 'CREATE')
  deleteOverride(@Param('overrideId') overrideId: string, @CurrentUser() actor: { userId: string }) {
    return this.users.deletePermissionOverride(overrideId, actor.userId);
  }
}
