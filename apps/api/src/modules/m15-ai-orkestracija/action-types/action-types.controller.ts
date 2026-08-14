import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActionTypesService } from './action-types.service';
import { CreateActionTypeDto } from './dto/create-action-type.dto';
import { UpdateActionTypeDto } from './dto/update-action-type.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M15 spec §9, prefiks /api/v1/ai-orchestration
@ApiTags('ai-orchestration-action-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-orchestration/action-types')
export class ActionTypesController {
  constructor(private readonly actionTypes: ActionTypesService) {}

  @Get()
  @RequirePermission('M15', 'agent-action-type', 'VIEW')
  findAll() {
    return this.actionTypes.findAll();
  }

  @Post()
  @RequirePermission('M15', 'agent-action-type', 'EDIT')
  create(@Body() dto: CreateActionTypeDto) {
    return this.actionTypes.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M15', 'agent-action-type', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateActionTypeDto) {
    return this.actionTypes.update(id, dto);
  }
}
